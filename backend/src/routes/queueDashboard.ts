import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from '../queue/emailQueue';

/**
 * Live BullMQ dashboard (Bull Board). Mounted under /api so it is reachable through the
 * Vite dev proxy at http://localhost:5173/api/admin/queues with the normal login cookie.
 */
export const QUEUE_DASHBOARD_PATH = '/api/admin/queues';

export function createQueueDashboardRouter() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(QUEUE_DASHBOARD_PATH);
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue, { displayName: 'Email sends' })],
    serverAdapter,
    options: { uiConfig: { boardTitle: 'MailPilot Queues' } },
  });
  return serverAdapter.getRouter();
}
