import { Router } from 'express';
import { z } from 'zod';
import { currentUserId } from '../middleware/auth';
import { listEmailsSchema, searchEmailsSchema } from '../schemas/campaign';
import { getAttachment, getEmail, getEmailCounts, listEmails, searchEmails, setStarred } from '../services/emailService';

export const emailsRouter = Router();

const idParam = z.object({ id: z.uuid() });

emailsRouter.get('/', async (req, res) => {
  const { status, filter, page, limit } = listEmailsSchema.parse(req.query);
  res.json(await listEmails(currentUserId(req), status, filter, page, limit));
});

emailsRouter.get('/counts', async (req, res) => {
  res.json(await getEmailCounts(currentUserId(req)));
});

emailsRouter.get('/search', async (req, res) => {
  res.json(await searchEmails(currentUserId(req), searchEmailsSchema.parse(req.query)));
});

emailsRouter.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await getEmail(currentUserId(req), id));
});

emailsRouter.get('/:id/attachments/:attachmentId', async (req, res) => {
  const { id, attachmentId } = z.object({ id: z.uuid(), attachmentId: z.uuid() }).parse(req.params);
  const file = await getAttachment(currentUserId(req), id, attachmentId);
  res.type(file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
  res.send(Buffer.from(file.content));
});

emailsRouter.patch('/:id/star', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { starred } = z.object({ starred: z.boolean() }).parse(req.body);
  res.json(await setStarred(currentUserId(req), id, starred));
});
