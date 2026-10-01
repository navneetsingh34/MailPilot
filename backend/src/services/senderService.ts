import { HttpError } from '../lib/httpError';
import { prisma } from '../lib/prisma';

export function listActiveSenders() {
  return prisma.sender.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, hourlyLimit: true },
  });
}

/** The chosen sender, or all active senders for round-robin assignment. */
export async function resolveSenders(senderId?: string) {
  const senders = await listActiveSenders();
  if (senders.length === 0) throw new HttpError(503, 'No active senders configured. Run `npm run seed:senders`.');
  if (!senderId) return senders;
  const chosen = senders.find((s) => s.id === senderId);
  if (!chosen) throw new HttpError(400, 'Unknown or inactive sender');
  return [chosen];
}
