export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  slack: { connected: false } | { connected: true; teamName: string; channel: string };
}

export type EmailStatus = 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED';
export type MailboxTab = 'scheduled' | 'sent';
export type EmailFilter = 'all' | 'starred' | 'failed';

export interface EmailListItem {
  id: string;
  recipient: string;
  subject: string;
  preview: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  failedAt: string | null;
  deferrals: number;
  error: string | null;
  starred: boolean;
  previewUrl: string | null;
  sender: { name: string; email: string };
}

export interface EmailPage {
  items: EmailListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface EmailSearchResult {
  items: EmailListItem[];
  total: number;
  engine: 'opensearch' | 'postgres';
}

export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface EmailDetail extends Omit<EmailListItem, 'preview'> {
  bodyHtml: string;
  createdAt: string;
  attachments: AttachmentMeta[];
}

export interface EmailCounts {
  scheduled: number;
  sent: number;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  hourlyLimit: number | null;
}

export interface NewAttachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

export interface CreateCampaignPayload {
  subject: string;
  bodyHtml: string;
  recipients: string[];
  startAt?: string;
  delayBetweenSeconds: number;
  hourlyLimit: number;
  senderId?: string;
  idempotencyKey: string;
  attachments: NewAttachment[];
}

export interface CreateCampaignResult {
  campaignId: string;
  scheduledCount: number;
  firstSendAt: string | null;
  lastSendAt: string | null;
  created: boolean;
}
