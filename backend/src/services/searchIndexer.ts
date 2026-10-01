import { setTimeout as sleep } from 'node:timers/promises';
import { htmlToPreview } from '../lib/html';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { EMAIL_INDEX, searchClient } from '../lib/search';

const FLUSH_INTERVAL_MS = 1000;
const MAX_BATCH = 500;
const MAX_RETRIES = 3;

/**
 * Keeps the search index in sync with Postgres (the source of truth).
 *
 * Callers only say "these emails changed" (markDirty). Every ~1s the indexer reloads
 * the current rows and bulk-writes them, one request at a time, so:
 *  - writes from the API and the worker can't race: each doc is versioned with the
 *    row's updatedAt (version_type external_gte), so an older snapshot never
 *    overwrites a newer one;
 *  - bursts (1000 emails scheduled at once) become a couple of bulk requests;
 *  - rows that no longer exist are removed from the index.
 * If indexing ever fails for good, `npm run search:reindex` rebuilds from Postgres.
 */
class SearchIndexer {
  private dirty = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> | null = null;

  markDirty(ids: string | string[]): void {
    if (!searchClient) return;
    for (const id of Array.isArray(ids) ? ids : [ids]) this.dirty.add(id);
    if (this.dirty.size >= MAX_BATCH) void this.flush();
    else this.timer ??= setTimeout(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  /** Writes everything pending. Safe to call concurrently; resolves when the index is caught up. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    while (this.flushing) await this.flushing;
    if (this.dirty.size === 0) return;

    this.flushing = (async () => {
      while (this.dirty.size > 0) {
        const ids = [...this.dirty].slice(0, MAX_BATCH);
        ids.forEach((id) => this.dirty.delete(id));
        await this.writeBatch(ids);
      }
    })().finally(() => {
      this.flushing = null;
    });
    await this.flushing;
  }

  private async writeBatch(ids: string[]): Promise<void> {
    const rows = await prisma.email.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        userId: true,
        campaignId: true,
        recipient: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        failedAt: true,
        starred: true,
        updatedAt: true,
        sender: { select: { email: true } },
        campaign: { select: { subject: true, bodyHtml: true } },
      },
    });
    const found = new Set(rows.map((r) => r.id));
    const body: object[] = [];
    for (const r of rows) {
      body.push(
        { index: { _index: EMAIL_INDEX, _id: r.id, version: r.updatedAt.getTime(), version_type: 'external_gte' } },
        {
          userId: r.userId,
          campaignId: r.campaignId,
          recipient: r.recipient,
          status: r.status,
          senderEmail: r.sender.email,
          subject: r.campaign.subject,
          body: htmlToPreview(r.campaign.bodyHtml, Infinity),
          scheduledAt: r.scheduledAt,
          sentAt: r.sentAt,
          failedAt: r.failedAt,
          starred: r.starred,
        },
      );
    }
    for (const id of ids) if (!found.has(id)) body.push({ delete: { _index: EMAIL_INDEX, _id: id } });

    for (let attempt = 1; ; attempt++) {
      try {
        const { body: res } = await searchClient!.bulk({ body });
        if (res.errors) {
          // Version conflicts just mean a newer snapshot already landed; deletes of
          // never-indexed docs are 404s. Anything else is worth a log line.
          const real = (res.items as Record<string, { status: number; error?: { type: string } }>[])
            .map((item) => Object.values(item)[0])
            .filter((op) => op.error && op.status !== 409 && op.status !== 404);
          if (real.length) logger.warn({ count: real.length, sample: real[0].error }, 'some search index writes failed');
        }
        return;
      } catch (err) {
        if (attempt >= MAX_RETRIES) {
          logger.error({ err, count: ids.length }, 'search indexing failed; run `npm run search:reindex` to repair');
          return;
        }
        await sleep(500 * 2 ** attempt);
      }
    }
  }
}

export const searchIndexer = new SearchIndexer();
