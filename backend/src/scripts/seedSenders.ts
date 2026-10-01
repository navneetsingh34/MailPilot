/**
 * Creates Ethereal test SMTP accounts and stores them as senders.
 * Idempotent: only tops up to the target count.
 *
 *   npm run seed:senders            # ensure 3 senders
 *   npm run seed:senders -- 5       # ensure 5 senders
 */
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

const DISPLAY_NAMES = ['Oliver Brown', 'Amanda Clark', 'Sarah Wilson', 'John Smith', 'Grant Miller'];

async function main() {
  // nodemailer caches the first test account per process unless told otherwise
  process.env.ETHEREAL_CACHE = 'no';
  const { default: nodemailer } = await import('nodemailer');
  const target = Number(process.argv[2] ?? 3);
  const existing = await prisma.sender.count();

  for (let i = existing; i < target; i++) {
    const account = await nodemailer.createTestAccount();
    const sender = await prisma.sender.create({
      data: {
        name: DISPLAY_NAMES[i % DISPLAY_NAMES.length],
        email: account.user,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPass: account.pass,
      },
    });
    logger.info({ email: sender.email }, 'created Ethereal sender');
  }

  const senders = await prisma.sender.findMany({ orderBy: { createdAt: 'asc' } });
  console.log('\nSenders (log in at https://ethereal.email/login to view their mailboxes):');
  console.table(senders.map((s) => ({ name: s.name, email: s.email, password: s.smtpPass })));
}

main()
  .catch((err) => {
    logger.error({ err }, 'seeding senders failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
