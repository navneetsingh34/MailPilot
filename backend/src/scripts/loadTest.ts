/**
 * Load test: schedules N emails "at the same moment" through the real HTTP API, watches
 * the queue drain, then checks the scheduler's guarantees against the database.
 *
 *   npm run load-test                                  # 1000 emails for the most recent user
 *   npm run load-test -- --count 2000 --watch 120      # more emails, watch for 2 minutes
 *   npm run load-test -- --user you@gmail.com          # schedule into a specific account
 *   npm run load-test -- --verify <campaignId>         # re-check guarantees later
 *   npm run load-test -- --cleanup <campaignId>        # delete a load-test campaign
 *
 * Needs the API running (npm run dev). Pair with a low MAX_EMAILS_PER_HOUR_PER_SENDER on
 * the worker to see hourly-limit deferral (and the Slack alert) within seconds.
 */
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { env } from '../config/env';
import { signSession } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { emailQueue } from '../queue/emailQueue';

const { values } = parseArgs({
  options: {
    count: { type: 'string', default: '1000' },
    'hourly-limit': { type: 'string', default: '10000' },
    delay: { type: 'string', default: '0' },
    watch: { type: 'string', default: '60' },
    user: { type: 'string' },
    api: { type: 'string', default: `http://localhost:${env.PORT}` },
    verify: { type: 'string' },
    cleanup: { type: 'string' },
  },
});

const fmt = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '-');

async function statusCounts(campaignId: string) {
  const groups = await prisma.email.groupBy({ by: ['status'], where: { campaignId }, _count: { _all: true } });
  const by = Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
  const deferred = await prisma.email.count({ where: { campaignId, deferrals: { gt: 0 } } });
  return { SCHEDULED: 0, SENDING: 0, SENT: 0, FAILED: 0, ...by, deferred };
}

async function verify(campaignId: string): Promise<boolean> {
  const total = await prisma.email.count({ where: { campaignId } });
  const c = await statusCounts(campaignId);
  const senderLimits = await prisma.sender.findMany({ select: { id: true, email: true, hourlyLimit: true } });
  const limitOf = (id: string) => senderLimits.find((s) => s.id === id)?.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER;

  const [dupes] = await prisma.$queryRaw<{ sent: bigint; distinct_ids: bigint }[]>`
    SELECT count(*) AS sent, count(DISTINCT "messageId") AS distinct_ids
    FROM "Email" WHERE "campaignId" = ${campaignId}::uuid AND status = 'SENT'`;
  // Busiest (sender, UTC hour) across ALL campaigns: hourly limits are per sender, not per campaign.
  const perHour = await prisma.$queryRaw<{ senderId: string; hour: Date; n: bigint }[]>`
    SELECT "senderId", date_trunc('hour', "sentAt") AS hour, count(*) AS n
    FROM "Email" WHERE status = 'SENT' AND "senderId" IN (SELECT DISTINCT "senderId" FROM "Email" WHERE "campaignId" = ${campaignId}::uuid)
    GROUP BY 1, 2 ORDER BY 3 DESC`;
  const gaps = await prisma.$queryRaw<{ senderId: string; min_gap_ms: number | null }[]>`
    SELECT "senderId", min(gap_ms) AS min_gap_ms FROM (
      SELECT "senderId", EXTRACT(EPOCH FROM ("sentAt" - lag("sentAt") OVER (PARTITION BY "senderId" ORDER BY "sentAt"))) * 1000 AS gap_ms
      FROM "Email" WHERE "campaignId" = ${campaignId}::uuid AND status = 'SENT'
    ) t GROUP BY 1`;

  const overLimit = perHour.filter((r) => Number(r.n) > limitOf(r.senderId));
  const tooClose = gaps.filter((g) => g.min_gap_ms !== null && g.min_gap_ms < env.MIN_DELAY_BETWEEN_SENDS_MS);
  const accounted = c.SCHEDULED + c.SENDING + c.SENT + c.FAILED === total;

  const checks: [string, boolean, string][] = [
    ['every email accounted for (nothing dropped)', accounted, `${total} rows = ${c.SCHEDULED} scheduled + ${c.SENDING} sending + ${c.SENT} sent + ${c.FAILED} failed`],
    ['no email sent twice', Number(dupes.sent) === Number(dupes.distinct_ids), `${dupes.sent} sent rows, ${dupes.distinct_ids} distinct Message-IDs`],
    ['hourly limit never exceeded per sender', overLimit.length === 0, perHour.slice(0, 3).map((r) => `${Number(r.n)}/${limitOf(r.senderId)} in ${fmt(r.hour).slice(0, 13)}h`).join(', ') || 'no sends yet'],
    [`>= ${env.MIN_DELAY_BETWEEN_SENDS_MS}ms between sends per sender`, tooClose.length === 0, gaps.map((g) => `${g.min_gap_ms === null ? '-' : Math.round(g.min_gap_ms)}ms`).join(', ') || 'n/a'],
    ['no permanent failures', c.FAILED === 0, `${c.FAILED} failed`],
  ];
  console.log('\nGuarantees:');
  for (const [name, ok, detail] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(42)} ${detail}`);
  return checks.every(([, ok]) => ok);
}

async function run() {
  const user = values.user
    ? await prisma.user.findUniqueOrThrow({ where: { email: values.user } })
    : await prisma.user.findFirstOrThrow({ orderBy: { updatedAt: 'desc' } });
  const count = Number(values.count);
  const runId = Date.now().toString(36);
  const recipients = Array.from({ length: count }, (_, i) => `load-${runId}-${i}@example.com`);

  console.log(`Scheduling ${count} emails for ${user.email} via ${values.api} (all due now, delay ${values.delay}s, campaign limit ${values['hourly-limit']}/h)`);
  const started = performance.now();
  const res = await fetch(`${values.api}/api/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `rb_session=${signSession({ sub: user.id, email: user.email })}` },
    body: JSON.stringify({
      subject: `Load test ${runId} (${count} emails)`,
      bodyHtml: `<p>Load test email from run <b>${runId}</b>.</p>`,
      recipients,
      delayBetweenSeconds: Number(values.delay),
      hourlyLimit: Number(values['hourly-limit']),
      idempotencyKey: `load-test-${runId}`,
    }),
  });
  const body = (await res.json()) as { campaignId: string; scheduledCount: number; firstSendAt: string; lastSendAt: string; error?: string };
  if (!res.ok) throw new Error(`API ${res.status}: ${body.error}`);
  console.log(`API accepted ${body.scheduledCount} emails in ${Math.round(performance.now() - started)}ms -> campaign ${body.campaignId}`);
  console.log(`Planned send window: ${fmt(new Date(body.firstSendAt))} .. ${fmt(new Date(body.lastSendAt))}`);

  const watchUntil = Date.now() + Number(values.watch) * 1000;
  console.log(`\nWatching for ${values.watch}s (Ctrl+C to stop; re-check later with --verify ${body.campaignId})`);
  while (Date.now() < watchUntil) {
    await sleep(5000);
    const c = await statusCounts(body.campaignId);
    const q = await emailQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed');
    console.log(
      `  ${new Date().toISOString().slice(11, 19)}  sent ${String(c.SENT).padStart(5)}  scheduled ${String(c.SCHEDULED).padStart(5)}  sending ${c.SENDING}  failed ${c.FAILED}  deferred-to-later-hour ${String(c.deferred).padStart(5)}   | queue delayed ${q.delayed} waiting ${q.waiting} active ${q.active}`,
    );
  }
  const ok = await verify(body.campaignId);
  console.log(`\nCleanup when done: npm run load-test -- --cleanup ${body.campaignId}`);
  return ok;
}

async function cleanup(campaignId: string) {
  const ids = (await prisma.email.findMany({ where: { campaignId }, select: { id: true } })).map((e) => e.id);
  for (let i = 0; i < ids.length; i += 200) await Promise.all(ids.slice(i, i + 200).map((id) => emailQueue.remove(id).catch(() => 0)));
  await prisma.campaign.delete({ where: { id: campaignId } });
  console.log(`Deleted campaign ${campaignId}: ${ids.length} emails and their queue jobs. Run \`npm run search:reindex -- --fresh\` to drop them from search.`);
  return true;
}

(values.cleanup ? cleanup(values.cleanup) : values.verify ? verify(values.verify) : run())
  .then((ok) => {
    process.exitCode = ok ? 0 : 1;
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await emailQueue.close();
    redis.disconnect();
    await prisma.$disconnect();
  });
