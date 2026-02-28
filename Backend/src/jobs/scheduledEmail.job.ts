import { GmailAccount, ScheduledEmail } from '../models';
import { sendGmailMessage } from '../services/gmail.service';

const INTERVAL_MS = 60 * 1000; // every minute

export function startScheduledEmailCron(): void {
  setInterval(async () => {
    try {
      const now = new Date();
      const pending = await ScheduledEmail.find({
        status: 'pending',
        scheduledFor: { $lte: now },
      })
        .sort({ scheduledFor: 1 })
        .limit(20)
        .lean();

      for (const row of pending) {
        const account = await GmailAccount.findById(row.gmailAccount);
        if (!account) {
          await ScheduledEmail.findByIdAndUpdate(row._id, {
            status: 'failed',
            error: 'Gmail account not found',
          });
          continue;
        }
        const result = await sendGmailMessage(account.refreshToken, {
          to: row.to,
          subject: row.subject,
          bodyPlain: row.bodyPlain ?? '',
        });
        if (result) {
          await ScheduledEmail.findByIdAndUpdate(row._id, {
            status: 'sent',
            sentAt: new Date(),
          });
        } else {
          await ScheduledEmail.findByIdAndUpdate(row._id, {
            status: 'failed',
            error: 'Gmail send failed',
          });
        }
      }
    } catch (err) {
      console.error('[ScheduledEmail] Cron error:', err);
    }
  }, INTERVAL_MS);
  console.log('[ScheduledEmail] Cron started (every 1 min)');
}
