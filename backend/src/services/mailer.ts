import nodemailer, { type Transporter } from 'nodemailer';
import { prisma } from '../lib/prisma';

/** Everything the worker needs to rate-limit and send one email, loaded in one query. */
export function loadOutboundEmail(emailId: string) {
  return prisma.email.findUniqueOrThrow({
    where: { id: emailId },
    select: {
      id: true,
      userId: true,
      campaignId: true,
      recipient: true,
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          hourlyLimit: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpPass: true,
        },
      },
      campaign: {
        select: {
          subject: true,
          bodyHtml: true,
          hourlyLimit: true,
          attachments: { select: { filename: true, mimeType: true, content: true } },
        },
      },
    },
  });
}

export type OutboundEmail = Awaited<ReturnType<typeof loadOutboundEmail>>;
type SmtpSender = OutboundEmail['sender'];

// One persistent SMTP connection per sender, reused across jobs. A single connection
// serialises that sender's sends, so together with the Redis send slot, consecutive
// sends from one sender are never closer than MIN_DELAY_BETWEEN_SENDS_MS.
const transports = new Map<string, Transporter>();

function transportFor(sender: SmtpSender): Transporter {
  let transport = transports.get(sender.id);
  if (!transport) {
    transport = nodemailer.createTransport({
      pool: true,
      maxConnections: 1,
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: { user: sender.smtpUser, pass: sender.smtpPass },
    });
    transports.set(sender.id, transport);
  }
  return transport;
}

export interface SendResult {
  messageId: string;
  previewUrl: string | null;
}

export async function sendEmail(email: OutboundEmail): Promise<SendResult> {
  const info = await transportFor(email.sender).sendMail({
    from: { name: email.sender.name, address: email.sender.email },
    to: email.recipient,
    subject: email.campaign.subject,
    html: email.campaign.bodyHtml,
    // Deterministic Message-ID: if a crash ever forces a resend, receivers can de-dupe it.
    messageId: `<${email.id}@mailpilot.scheduler>`,
    attachments: email.campaign.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.mimeType,
      content: Buffer.from(a.content),
    })),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return { messageId: info.messageId, previewUrl: previewUrl || null };
}

export function closeTransports() {
  for (const transport of transports.values()) transport.close();
  transports.clear();
}
