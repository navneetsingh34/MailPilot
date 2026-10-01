import type { Prisma } from '../generated/prisma/client';
import type { EmailStatus } from '../generated/prisma/enums';
import { htmlToPreview } from '../lib/html';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import type { EmailFilter } from '../schemas/campaign';
import { EMAIL_INDEX, searchClient } from '../lib/search';
import { searchIndexer } from './searchIndexer';

export type EmailTab = 'scheduled' | 'sent';

const TAB_STATUSES: Record<EmailTab, EmailStatus[]> = {
  scheduled: ['SCHEDULED', 'SENDING'],
  sent: ['SENT', 'FAILED'],
};

const listSelect = {
  id: true,
  recipient: true,
  status: true,
  scheduledAt: true,
  sentAt: true,
  failedAt: true,
  deferrals: true,
  error: true,
  starred: true,
  previewUrl: true,
  campaign: { select: { subject: true, bodyHtml: true } },
  sender: { select: { name: true, email: true } },
} as const satisfies Prisma.EmailSelect;

type ListRow = Prisma.EmailGetPayload<{ select: typeof listSelect }>;

const toListItem = ({ campaign, ...email }: ListRow) => ({
  ...email,
  subject: campaign.subject,
  preview: htmlToPreview(campaign.bodyHtml),
});

/** Status set for a tab + filter combination; undefined = any status. */
function statusesFor(tab: EmailTab | undefined, filter: EmailFilter): EmailStatus[] | undefined {
  if (filter === 'failed') return ['FAILED'];
  return tab && TAB_STATUSES[tab];
}

export async function listEmails(userId: string, tab: EmailTab, filter: EmailFilter, page: number, limit: number) {
  const where: Prisma.EmailWhereInput = {
    userId,
    status: { in: statusesFor(tab, filter) },
    ...(filter === 'starred' && { starred: true }),
  };
  const [rows, total] = await Promise.all([
    prisma.email.findMany({
      where,
      select: listSelect,
      // Scheduled: next-due first. Sent: most recently finished first.
      orderBy: [tab === 'scheduled' ? { scheduledAt: 'asc' } : { completedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.email.count({ where }),
  ]);
  return { items: rows.map(toListItem), total, page, limit };
}

export async function getEmailCounts(userId: string) {
  const groups = await prisma.email.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } });
  const count = (statuses: EmailStatus[]) =>
    groups.filter((g) => statuses.includes(g.status)).reduce((sum, g) => sum + g._count._all, 0);
  return { scheduled: count(TAB_STATUSES.scheduled), sent: count(TAB_STATUSES.sent) };
}

export async function getEmail(userId: string, id: string) {
  const email = await prisma.email.findFirst({
    where: { id, userId },
    select: {
      ...listSelect,
      createdAt: true,
      campaign: {
        select: {
          subject: true,
          bodyHtml: true,
          attachments: { select: { id: true, filename: true, mimeType: true, size: true } },
        },
      },
    },
  });
  if (!email) throw new HttpError(404, 'Email not found');
  const { campaign, ...rest } = email;
  return { ...rest, subject: campaign.subject, bodyHtml: campaign.bodyHtml, attachments: campaign.attachments };
}

export async function setStarred(userId: string, id: string, starred: boolean) {
  const { count } = await prisma.email.updateMany({ where: { id, userId }, data: { starred } });
  if (count === 0) throw new HttpError(404, 'Email not found');
  searchIndexer.markDirty(id);
  return { id, starred };
}

export interface SearchParams {
  q: string;
  tab?: EmailTab;
  filter: EmailFilter;
  limit: number;
}

/**
 * Full-text search over the user's emails (recipient, subject, body).
 * OpenSearch finds and ranks the matching ids; rows are then loaded from Postgres so
 * statuses are always current. Falls back to a Postgres ILIKE search if the search
 * cluster is unavailable.
 */
export async function searchEmails(userId: string, { q, tab, filter, limit }: SearchParams) {
  const statuses = statusesFor(tab, filter);
  const starredOnly = filter === 'starred';
  if (searchClient) {
    try {
      const { body } = await searchClient.search({
        index: EMAIL_INDEX,
        body: {
          size: limit,
          track_total_hits: true,
          _source: false,
          query: {
            bool: {
              filter: [
                { term: { userId } },
                ...(statuses ? [{ terms: { status: statuses } }] : []),
                ...(starredOnly ? [{ term: { starred: true } }] : []),
              ],
              must: [
                {
                  multi_match: {
                    query: q,
                    type: 'bool_prefix',
                    fields: [
                      'subject^3',
                      'subject._2gram',
                      'subject._3gram',
                      'recipient^2',
                      'recipient._2gram',
                      'recipient._3gram',
                      'body',
                    ],
                  },
                },
              ],
            },
          },
          sort: ['_score', { scheduledAt: 'desc' }],
        },
      });
      const ids = (body.hits.hits as { _id: string }[]).map((h) => h._id);
      const total = typeof body.hits.total === 'number' ? body.hits.total : (body.hits.total?.value ?? ids.length);
      const rows = await prisma.email.findMany({ where: { id: { in: ids }, userId }, select: listSelect });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const items = ids.flatMap((id) => (byId.has(id) ? [toListItem(byId.get(id)!)] : []));
      return { items, total, engine: 'opensearch' as const };
    } catch (err) {
      logger.warn({ err }, 'search cluster unavailable; falling back to Postgres');
    }
  }

  const where: Prisma.EmailWhereInput = {
    userId,
    ...(statuses && { status: { in: statuses } }),
    ...(starredOnly && { starred: true }),
    OR: [
      { recipient: { contains: q, mode: 'insensitive' } },
      { campaign: { subject: { contains: q, mode: 'insensitive' } } },
    ],
  };
  const [rows, total] = await Promise.all([
    prisma.email.findMany({ where, select: listSelect, orderBy: { scheduledAt: 'desc' }, take: limit }),
    prisma.email.count({ where }),
  ]);
  return { items: rows.map(toListItem), total, engine: 'postgres' as const };
}

/** Raw attachment bytes, only if the email belongs to this user. */
export async function getAttachment(userId: string, emailId: string, attachmentId: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, campaign: { emails: { some: { id: emailId, userId } } } },
    select: { filename: true, mimeType: true, content: true },
  });
  if (!attachment) throw new HttpError(404, 'Attachment not found');
  return attachment;
}
