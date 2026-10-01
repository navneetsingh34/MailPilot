import { z } from 'zod';

export const MAX_RECIPIENTS = 10_000;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export const createCampaignSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(300),
  bodyHtml: z.string().min(1, 'Body is required').max(200_000),
  recipients: z
    .array(z.string().trim().toLowerCase().pipe(z.email()))
    .min(1, 'Add at least one recipient')
    .max(MAX_RECIPIENTS, `At most ${MAX_RECIPIENTS} recipients per campaign`),
  /** ISO timestamp; past/omitted = start now */
  startAt: z.coerce.date().optional(),
  delayBetweenSeconds: z.coerce.number().int().min(0).max(3600).default(0),
  hourlyLimit: z.coerce.number().int().min(1).max(10_000),
  senderId: z.uuid().optional(),
  idempotencyKey: z.string().min(8).max(100).optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(255),
        contentBase64: z.string().refine((s) => Buffer.byteLength(s, 'base64') <= MAX_ATTACHMENT_BYTES, {
          message: 'Each attachment must be 2 MB or less',
        }),
      }),
    )
    .max(3)
    .default([]),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

/** all | starred only | failed only (meaningful on the Sent tab) */
const emailFilter = z.enum(['all', 'starred', 'failed']).default('all');

export const searchEmailsSchema = z.object({
  q: z.string().trim().min(1).max(200),
  tab: z.enum(['scheduled', 'sent']).optional(),
  filter: emailFilter,
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listEmailsSchema = z.object({
  status: z.enum(['scheduled', 'sent']),
  filter: emailFilter,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type EmailFilter = z.infer<typeof emailFilter>;
