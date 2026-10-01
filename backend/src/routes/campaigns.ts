import { Router } from 'express';
import { logger } from '../lib/logger';
import { currentUserId } from '../middleware/auth';
import { enqueueEmails } from '../queue/emailQueue';
import { createCampaignSchema } from '../schemas/campaign';
import { createCampaign } from '../services/campaignService';
import { searchIndexer } from '../services/searchIndexer';

export const campaignsRouter = Router();

campaignsRouter.post('/', async (req, res) => {
  const input = createCampaignSchema.parse(req.body);
  const { emails, ...result } = await createCampaign(currentUserId(req), input);

  // Rows are committed first, then jobs added. Also runs on idempotent replays (jobId
  // dedupe makes that a no-op), which heals a crash that happened between the two steps.
  try {
    await enqueueEmails(emails);
  } catch (err) {
    logger.error({ err, campaignId: result.campaignId }, 'enqueue failed; the worker reconciler will pick these up');
  }
  searchIndexer.markDirty(emails.map((e) => e.id));

  res.status(result.created ? 201 : 200).json(result);
});
