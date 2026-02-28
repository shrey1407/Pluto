import crypto from 'crypto';
import { Response } from 'express';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import {
  User,
  GmailAccount,
  SyncedEmail,
  EmailTask,
  ScheduledEmail,
  LoyaltyTransaction,
} from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  getGmailAuthUrl,
  exchangeGmailCode,
  listGmailMessages,
  getGmailMessage,
  sendGmailMessage,
  getGmailProfile,
  getGmailUnreadCount,
  listGmailThreadIds,
  getGmailThread,
  getGmailMessageMetadata,
  getGmailLatestActivityTimestamp,
} from '../services/gmail.service';
import {
  COST_EMAIL_TASKS,
  COST_EMAIL_SUGGEST_REPLY,
  EMAIL_SYNC_DAYS,
  EMAIL_SYNC_MAX_MESSAGES,
} from '../utils/constants';
import { redactSensitiveContent } from '../utils/emailSecurity';
import { generateWithGemini } from '../trendcraft/services/gemini.service';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error('JWT_SECRET is not set in environment');
  return secret;
}

/** GET /api/email-integration/gmail/auth-url - Get OAuth URL to connect Gmail. state = JWT with userId. */
export const getGmailConnectUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const secret = getJwtSecret();
    const userId = req.user!.id;
    const baseUrl = (process.env.PULSEBOT_WEBHOOK_BASE_URL || process.env.CORS_ORIGIN || '').replace(/\/$/, '');
    const backendOrigin = process.env.BACKEND_PUBLIC_URL || baseUrl || `http://localhost:${process.env.PORT || 5000}`;
    const redirectUri = `${backendOrigin}/api/email-integration/gmail/callback`;
    const state = jwt.sign({ purpose: 'gmail_connect', userId }, secret, { expiresIn: '10m' });

    const url = getGmailAuthUrl(redirectUri, state);
    if (!url) {
      res.status(503).json({
        success: false,
        message: 'Gmail integration not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      });
      return;
    }

    res.json({ success: true, data: { url, redirectUri } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to get auth URL';
    if (msg.includes('JWT_SECRET')) {
      res.status(503).json({ success: false, message: 'Server misconfigured: JWT_SECRET is not set.' });
      return;
    }
    res.status(500).json({ success: false, message: msg });
  }
};

/** GET /api/email-integration/gmail/callback - OAuth callback. Creates GmailAccount, redirects to frontend. */
export const gmailCallback = async (req: { query: { code?: string; state?: string } }, res: Response): Promise<void> => {
  try {
    const { code, state } = req.query;
    const frontendOrigin = process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';
    const pulsebotPath = `${frontendOrigin}/pulsebot`;

    if (!code || !state) {
      res.redirect(302, `${pulsebotPath}?error=missing_params`);
      return;
    }

    const secret = getJwtSecret();
    let payload: { purpose?: string; userId?: string };
    try {
      payload = jwt.verify(state as string, secret) as { purpose?: string; userId?: string };
    } catch {
      res.redirect(302, `${pulsebotPath}?error=invalid_state`);
      return;
    }
    if (payload.purpose !== 'gmail_connect' || !payload.userId) {
      res.redirect(302, `${pulsebotPath}?error=invalid_state`);
      return;
    }

    const backendOrigin =
      process.env.BACKEND_PUBLIC_URL ||
      process.env.PULSEBOT_WEBHOOK_BASE_URL ||
      process.env.CORS_ORIGIN ||
      `http://localhost:${process.env.PORT || 5000}`;
    const redirectUri = `${(backendOrigin as string).replace(/\/$/, '')}/api/email-integration/gmail/callback`;

    const result = await exchangeGmailCode(code as string, redirectUri);
    if (!result) {
      res.redirect(302, `${pulsebotPath}?error=exchange_failed`);
      return;
    }

    const existing = await GmailAccount.findOne({ user: new Types.ObjectId(payload.userId) });
    if (existing) {
      existing.refreshToken = result.refreshToken;
      existing.email = result.email;
      await existing.save();
    } else {
      await GmailAccount.create({
        user: new Types.ObjectId(payload.userId),
        email: result.email,
        refreshToken: result.refreshToken,
      });
    }

    res.redirect(302, `${pulsebotPath}?gmail=connected`);
  } catch (err) {
    console.error('gmailCallback error:', err);
    const frontendOrigin = process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';
    res.redirect(302, `${frontendOrigin}/pulsebot?error=server_error`);
  }
};

/** POST /api/email-integration/gmail/disconnect - Remove Gmail account. */
export const disconnectGmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    await GmailAccount.deleteOne({ user: new Types.ObjectId(userId) });
    await SyncedEmail.deleteMany({ user: new Types.ObjectId(userId) });
    await EmailTask.deleteMany({ user: new Types.ObjectId(userId) });
    res.json({ success: true, message: 'Gmail disconnected' });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to disconnect',
    });
  }
};

/** POST /api/email-integration/gmail/sync - Fetch recent emails and store. */
export const syncGmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const account = await GmailAccount.findOne({ user: new Types.ObjectId(userId) });
    if (!account) {
      res.status(400).json({ success: false, message: 'Connect Gmail first' });
      return;
    }

    const since = new Date();
    since.setDate(since.getDate() - EMAIL_SYNC_DAYS);
    const y = since.getFullYear();
    const m = since.getMonth() + 1;
    const d = since.getDate();
    const q = `after:${y}/${m}/${d}`;
    const list = await listGmailMessages(account.refreshToken, {
      maxResults: EMAIL_SYNC_MAX_MESSAGES,
      q,
    });

    let synced = 0;
    for (const item of list) {
      const full = await getGmailMessage(account.refreshToken, item.id);
      if (!full) continue;

      await SyncedEmail.findOneAndUpdate(
        { user: new Types.ObjectId(userId), gmailAccount: account._id, messageId: full.id },
        {
          $set: {
            threadId: full.threadId,
            from: full.from,
            to: full.to,
            subject: full.subject,
            snippet: full.snippet,
            bodyPlain: full.bodyPlain,
            bodyHtml: full.bodyHtml,
            date: full.date,
            labelIds: full.labelIds,
          },
        },
        { upsert: true, new: true }
      );
      synced++;
    }

    account.lastSyncedAt = new Date();
    await account.save();

    const message =
      list.length === 0
        ? 'No messages in inbox in the last 7 days. Try again later or check the date.'
        : `Synced ${synced} of ${list.length} emails`;
    res.json({
      success: true,
      data: { synced, total: list.length },
      message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Sync failed',
    });
  }
};

/** In-memory cache for list-tasks by (userId + hash of synced email set). Avoids re-calling Gemini when emails unchanged. */
const TASKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const tasksListCache = new Map<
  string,
  { tasks: Array<{ _id: string; syncedEmail: { messageId: string; subject: string; from: string; date: Date }; title: string; description: string; type: string }>; createdAt: number }
>();

function getTasksCacheKey(userId: string, messageIds: string[]): string {
  const sorted = [...messageIds].sort();
  const hash = crypto.createHash('sha256').update(sorted.join(',')).digest('hex');
  return `${userId}:${hash}`;
}

/** Deduct loyalty for email AI features. */
async function deductEmailPoints(userId: string, cost: number): Promise<{ ok: boolean; newBalance?: number }> {
  const user = await User.findById(userId);
  if (!user || user.loyaltyPoints < cost) return { ok: false };
  const newBalance = user.loyaltyPoints - cost;
  await User.findByIdAndUpdate(userId, { loyaltyPoints: newBalance });
  await LoyaltyTransaction.create({
    user: new Types.ObjectId(userId),
    type: 'feature_use',
    amount: -cost,
    balanceAfter: newBalance,
    referenceType: 'Feature',
    metadata: { feature: 'email_integration' },
  });
  return { ok: true, newBalance };
}

/** GET /api/email-integration/tasks - List AI-extracted tasks from synced emails. Costs loyalty. Cached when email set unchanged. */
export const listTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const account = await GmailAccount.findOne({ user: new Types.ObjectId(userId) });
    if (!account) {
      res.status(400).json({ success: false, message: 'Connect Gmail first' });
      return;
    }

    const since = new Date();
    since.setDate(since.getDate() - EMAIL_SYNC_DAYS);
    const emails = await SyncedEmail.find({
      user: new Types.ObjectId(userId),
      gmailAccount: account._id,
      date: { $gte: since },
      taskResolved: { $ne: true },
    })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    if (emails.length === 0) {
      const user = await User.findById(userId);
      res.json({
        success: true,
        data: { tasks: [], newBalance: user?.loyaltyPoints ?? 0 },
        message: 'No recent emails to analyze. Sync first.',
      });
      return;
    }

    const messageIds = emails.map((e) => e.messageId ?? '').filter(Boolean);
    const cacheKey = getTasksCacheKey(userId, messageIds);
    const cached = tasksListCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.createdAt < TASKS_CACHE_TTL_MS) {
      const user = await User.findById(userId);
      res.json({
        success: true,
        data: { tasks: cached.tasks, newBalance: user?.loyaltyPoints ?? 0 },
        message: 'Tasks (from cache; no extra cost).',
      });
      return;
    }
    if (cached) tasksListCache.delete(cacheKey);

    const deduction = await deductEmailPoints(userId, COST_EMAIL_TASKS);
    if (!deduction.ok) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. This action costs ${COST_EMAIL_TASKS} points.`,
      });
      return;
    }

    const userEmail = (account.email ?? '').toLowerCase().trim();
    const emailsFromOthers = userEmail
      ? emails.filter((e) => !(e.from ?? '').toLowerCase().includes(userEmail))
      : emails;

    const emailList = emailsFromOthers
      .map((e) => {
        const snippet = (e.snippet ?? '').slice(0, 400);
        const subject = e.subject ?? '';
        const redactedSnippet = redactSensitiveContent(snippet);
        const redactedSubject = redactSensitiveContent(subject);
        return `[ID: ${e.messageId}] From: ${e.from} | To: ${e.to} | Subject: ${redactedSubject} | Date: ${e.date.toISOString()} | Snippet: ${redactedSnippet}`;
      })
      .join('\n\n');

    const prompt = `You are a strict email-task filter. Your job is to return ONLY emails that clearly and explicitly require a reply or action from the user.

RULES:
- User's email (do not treat as tasks): ${account.email ?? 'unknown'}
- Include ONLY if: the email is from someone else, directly addressed to the user, and contains a clear question, request, or call for action that expects a response (e.g. "Are you available?", "Please confirm", "Can you reply by...?", meeting/availability ask).
- EXCLUDE: newsletters, marketing, promotions, automated alerts, bank/transaction notifications, no-reply senders, receipts, bulk mail, "do not reply" senders, informational-only emails, and anything that does not explicitly ask the user to respond.
- When in doubt, EXCLUDE. Only include if there is a clear, direct request or question expecting a reply.
- Output format: a JSON array only. Use the exact messageId from the list (copy it exactly). If zero emails qualify, output exactly: []

Format (one entry per qualifying email): [{"messageId":"<id>","type":"reply_needed|follow_up|action|info","title":"Short title","description":"What to do or suggest"}]

Emails (each line has [ID: ...] — use that exact ID if you include it):
${emailList}

JSON array:`;

    const raw = await generateWithGemini(prompt, { responseMimeType: 'application/json', maxOutputTokens: 2048 });
    
    let tasks: Array<{ messageId: string; type: string; title: string; description: string }> = [];
    if (raw) {
      const extractJsonArray = (s: string): string => {
        const start = s.indexOf('[');
        const end = s.lastIndexOf(']');
        if (start !== -1 && end > start) return s.slice(start, end + 1);
        if (start !== -1) return s.slice(start).trim();
        return s.trim();
      };
      const normalizeForParse = (s: string): string => {
        let out = s.trim();
        out = out.replace(/,(\s*)]/g, '$1]');
        if (!out.endsWith(']')) {
          if (out.endsWith('"')) out += '}]';
          else if (out.endsWith('}')) out += ']';
          else if (out.endsWith(',')) out = out.replace(/,?\s*$/, ']');
        }
        return out;
      };
      for (const extracted of [extractJsonArray(raw), raw]) {
        const candidate = normalizeForParse(extracted);
        try {
          const parsed = JSON.parse(candidate) as unknown;
          if (Array.isArray(parsed)) {
            tasks = parsed.filter((t) => t && typeof t.messageId === 'string');
            break;
          }
        } catch {
          continue;
        }
      }
    }

    // Fallback: only when AI returned zero tasks; exclude automated/bank/promo senders
    if (tasks.length === 0 && emailsFromOthers.length > 0) {
      const needsReply = /\?|confirm|meeting|available|reply|ask|schedule|tomorrow|please\s+(confirm|reply|let me know)/i;
      const automated = /no-?reply|donotreply|mailer|@mailers\.|noreply|notification|alert@|bank|netbanking|newsletter|promo/i;
      for (const e of emailsFromOthers) {
        const rawSnippet = (e.snippet ?? '') + ' ' + (e.subject ?? '');
        const from = (e.from ?? '').toLowerCase();
        if (needsReply.test(rawSnippet) && !automated.test(from)) {
          const safeDescription = redactSensitiveContent((e.snippet ?? e.subject ?? '').slice(0, 150));
          tasks.push({
            messageId: e.messageId,
            type: 'reply_needed',
            title: 'Reply needed',
            description: safeDescription,
          });
        }
      }
    }

    const taskDocs: Array<{ _id: string; syncedEmail: { messageId: string; subject: string; from: string; date: Date }; title: string; description: string; type: string }> = [];
    for (const t of tasks) {
      const id = String(t.messageId).trim();
      const email = emails.find((e) => e.messageId === id || e.messageId === t.messageId);
      if (!email) continue;
      if (userEmail && (email.from ?? '').toLowerCase().includes(userEmail)) continue;
      let doc = await EmailTask.findOne({ user: new Types.ObjectId(userId), syncedEmail: email._id });
      if (!doc) {
        doc = await EmailTask.create({
          user: new Types.ObjectId(userId),
          syncedEmail: email._id,
          title: t.title || 'Reply or action needed',
          description: t.description || '',
          type: (t.type as 'reply_needed' | 'follow_up' | 'action' | 'info') || 'reply_needed',
        });
      }
      taskDocs.push({
        _id: doc._id.toString(),
        syncedEmail: {
          messageId: email.messageId,
          subject: email.subject,
          from: email.from,
          date: email.date,
        },
        title: doc.title,
        description: doc.description,
        type: doc.type,
      });
    }

    tasksListCache.set(cacheKey, { tasks: taskDocs, createdAt: Date.now() });

    res.json({
      success: true,
      data: { tasks: taskDocs, newBalance: deduction.newBalance },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list tasks',
    });
  }
};

/** GET /api/email-integration/emails/:messageId - Get one email and its task if any. */
export const getEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { messageId } = req.params;
    const account = await GmailAccount.findOne({ user: new Types.ObjectId(userId) });
    if (!account) {
      res.status(400).json({ success: false, message: 'Connect Gmail first' });
      return;
    }

    const email = await SyncedEmail.findOne({
      user: new Types.ObjectId(userId),
      gmailAccount: account._id,
      messageId,
    }).lean();
    if (!email) {
      res.status(404).json({ success: false, message: 'Email not found. Sync first.' });
      return;
    }

    const task = await EmailTask.findOne({
      user: new Types.ObjectId(userId),
      syncedEmail: email._id,
    }).lean();

    res.json({
      success: true,
      data: {
        email: {
          messageId: email.messageId,
          threadId: email.threadId,
          from: email.from,
          to: email.to,
          subject: email.subject,
          snippet: email.snippet,
          bodyPlain: email.bodyPlain,
          date: email.date,
        },
        task: task
          ? {
              _id: task._id,
              title: task.title,
              description: task.description,
              type: task.type,
              suggestedReply: task.suggestedReply,
              confirmedReply: task.confirmedReply,
              replySentAt: task.replySentAt,
            }
          : null,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get email',
    });
  }
};

/** POST /api/email-integration/tasks/:taskId/suggest-reply - AI suggests a reply. Body: { userMessage?: string }. */
export const suggestReply = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;
    const userMessage = (req.body.userMessage as string)?.trim();

    const task = await EmailTask.findById(taskId).populate('syncedEmail');
    if (!task || task.user.toString() !== userId) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    const synced = task.syncedEmail as unknown as { subject: string; from: string; bodyPlain?: string; snippet: string };
    const deduction = await deductEmailPoints(userId, COST_EMAIL_SUGGEST_REPLY);
    if (!deduction.ok) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. This action costs ${COST_EMAIL_SUGGEST_REPLY} points.`,
      });
      return;
    }

    const body = synced.bodyPlain || synced.snippet;
    const redactedBody = redactSensitiveContent(body);
    const redactedSubject = redactSensitiveContent(synced.subject ?? '');
    const prompt = userMessage
      ? `Original email:\nFrom: ${synced.from}\nSubject: ${redactedSubject}\n\n${redactedBody}\n\nUser request: ${userMessage}\n\nWrite a professional reply (plain text, no HTML). Reply only:`
      : `Original email:\nFrom: ${synced.from}\nSubject: ${redactedSubject}\n\n${redactedBody}\n\nTask: ${task.description}\n\nWrite a professional reply (plain text, no HTML). Reply only:`;

    const suggestedReply = await generateWithGemini(prompt, { maxOutputTokens: 1024 });
    if (suggestedReply) {
      task.suggestedReply = suggestedReply;
      await task.save();
    }

    res.json({
      success: true,
      data: {
        suggestedReply: suggestedReply || task.suggestedReply,
        newBalance: deduction.newBalance,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to suggest reply',
    });
  }
};

/** POST /api/email-integration/tasks/:taskId/send - Send the confirmed reply via Gmail. Body: { confirmedReply: string }. */
export const sendReply = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;
    const confirmedReply = (req.body.confirmedReply as string)?.trim();
    if (!confirmedReply) {
      res.status(400).json({ success: false, message: 'confirmedReply is required' });
      return;
    }

    const task = await EmailTask.findById(taskId).populate('syncedEmail');
    if (!task || task.user.toString() !== userId) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }
    if (task.replySentAt) {
      res.status(400).json({ success: false, message: 'Reply already sent' });
      return;
    }

    const account = await GmailAccount.findOne({ user: new Types.ObjectId(userId) });
    if (!account) {
      res.status(400).json({ success: false, message: 'Gmail account not found' });
      return;
    }

    const synced = task.syncedEmail as unknown as { from: string; subject: string; threadId: string; messageId: string };
    const replyTo = synced.from.replace(/^.*<([^>]+)>.*$/, '$1').trim() || synced.from;
    const subject = synced.subject.startsWith('Re:') ? synced.subject : `Re: ${synced.subject}`;

    const result = await sendGmailMessage(account.refreshToken, {
      to: replyTo,
      subject,
      bodyPlain: confirmedReply,
      threadId: synced.threadId,
    });

    if (!result) {
      res.status(503).json({ success: false, message: 'Failed to send via Gmail. Check connection.' });
      return;
    }

    task.confirmedReply = confirmedReply;
    task.replySentAt = new Date();
    await task.save();

    const syncedDoc = await SyncedEmail.findById(task.syncedEmail);
    if (syncedDoc) {
      syncedDoc.taskResolved = true;
      await syncedDoc.save();
    }

    res.json({
      success: true,
      data: { sent: true, messageId: result.id },
      message: 'Reply sent',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to send reply',
    });
  }
};

/** GET /api/email-integration/status - Connected accounts and last sync. */
export const getStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const account = await GmailAccount.findOne({ user: new Types.ObjectId(userId) }).lean();
    const count = account
      ? await SyncedEmail.countDocuments({ user: new Types.ObjectId(userId), gmailAccount: account._id })
      : 0;

    res.json({
      success: true,
      data: {
        gmail: account
          ? { connected: true, email: account.email, lastSyncedAt: account.lastSyncedAt, syncedCount: count }
          : { connected: false },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get status',
    });
  }
};

/** GET /api/email-integration/gmail/digest - Non-AI Gmail digest: unread, top threads, last activity, most active sender. */
export const getGmailDigest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const account = await GmailAccount.findOne({ user: new Types.ObjectId(userId) });
    if (!account) {
      res.status(400).json({ success: false, message: 'Connect Gmail first' });
      return;
    }

    const [profile, unreadCount, threadIds, lastActivityAt, mostActiveFromDb] = await Promise.all([
      getGmailProfile(account.refreshToken),
      getGmailUnreadCount(account.refreshToken),
      listGmailThreadIds(account.refreshToken, { maxResults: 15 }),
      getGmailLatestActivityTimestamp(account.refreshToken),
      SyncedEmail.aggregate<{ _id: string; count: number }>([
        { $match: { user: new Types.ObjectId(userId), gmailAccount: account._id } },
        { $group: { _id: { $toLower: '$from' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
        { $project: { _id: 1, count: 1 } },
      ]),
    ]);

    const threadsWithCount: Array<{ threadId: string; messageCount: number; firstMessageId?: string }> = [];
    for (const t of threadIds) {
      const thread = await getGmailThread(account.refreshToken, t.id);
      if (thread && thread.messageCount > 0) {
        threadsWithCount.push({
          threadId: thread.id,
          messageCount: thread.messageCount,
          firstMessageId: thread.firstMessageId,
        });
      }
    }
    threadsWithCount.sort((a, b) => b.messageCount - a.messageCount);
    const top5 = threadsWithCount.slice(0, 5);

    const topThreadsWithSubject: Array<{ threadId: string; messageCount: number; subject: string }> = [];
    for (const t of top5) {
      let subject = '(no subject)';
      if (t.firstMessageId) {
        const meta = await getGmailMessageMetadata(account.refreshToken, t.firstMessageId);
        if (meta?.subject) subject = meta.subject.slice(0, 120);
      }
      topThreadsWithSubject.push({ threadId: t.threadId, messageCount: t.messageCount, subject });
    }

    const mostActiveSender = mostActiveFromDb[0]
      ? { email: mostActiveFromDb[0]._id, count: mostActiveFromDb[0].count }
      : null;

    const last3Emails = await SyncedEmail.find({
      user: new Types.ObjectId(userId),
      gmailAccount: account._id,
    })
      .sort({ date: -1 })
      .limit(3)
      .select('messageId subject from date snippet')
      .lean();

    res.json({
      success: true,
      data: {
        unreadCount,
        totalMessages: profile?.messagesTotal ?? null,
        totalThreads: profile?.threadsTotal ?? null,
        topThreads: topThreadsWithSubject,
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        mostActiveSender,
        lastEmails: last3Emails.map((e) => ({
          messageId: e.messageId,
          subject: e.subject ?? '(no subject)',
          from: e.from ?? '',
          date: e.date?.toISOString?.() ?? new Date(e.date).toISOString(),
          snippet: (e.snippet ?? '').slice(0, 120),
        })),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get Gmail digest',
    });
  }
};

/** POST /api/email-integration/scheduled - Schedule an email to send later. Body: { to, subject, bodyPlain, scheduledFor: ISO date string }. */
export const scheduleEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const account = await GmailAccount.findOne({ user: new Types.ObjectId(userId) });
    if (!account) {
      res.status(400).json({ success: false, message: 'Connect Gmail first' });
      return;
    }
    const { to, subject, bodyPlain, scheduledFor: scheduledForRaw } = req.body as {
      to?: string;
      subject?: string;
      bodyPlain?: string;
      scheduledFor?: string;
    };
    const toTrim = (to ?? '').toString().trim();
    const subjectTrim = (subject ?? '').toString().trim();
    const bodyTrim = (bodyPlain ?? '').toString();
    if (!toTrim) {
      res.status(400).json({ success: false, message: 'to is required' });
      return;
    }
    const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : null;
    if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
      res.status(400).json({ success: false, message: 'scheduledFor must be a valid date/time (ISO string)' });
      return;
    }
    const now = new Date();
    if (scheduledFor.getTime() <= now.getTime()) {
      res.status(400).json({ success: false, message: 'scheduledFor must be in the future' });
      return;
    }
    const doc = await ScheduledEmail.create({
      user: new Types.ObjectId(userId),
      gmailAccount: account._id,
      to: toTrim,
      subject: subjectTrim,
      bodyPlain: bodyTrim,
      scheduledFor,
      status: 'pending',
    });
    res.status(201).json({
      success: true,
      data: {
        _id: doc._id.toString(),
        to: doc.to,
        subject: doc.subject,
        scheduledFor: doc.scheduledFor.toISOString(),
        status: doc.status,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to schedule email',
    });
  }
};

/** GET /api/email-integration/scheduled - List current user's scheduled emails (pending first, then recent). */
export const listScheduledEmails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const account = await GmailAccount.findOne({ user: new Types.ObjectId(userId) });
    if (!account) {
      res.status(400).json({ success: false, message: 'Connect Gmail first' });
      return;
    }
    const sentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const list = await ScheduledEmail.find({
      user: new Types.ObjectId(userId),
      $or: [
        { status: { $ne: 'sent' } },
        { status: 'sent', sentAt: { $gte: sentCutoff } },
      ],
    })
      .sort({ status: 1, scheduledFor: 1 })
      .limit(50)
      .lean();
    res.json({
      success: true,
      data: list.map((e) => ({
        _id: e._id.toString(),
        to: e.to,
        subject: e.subject,
        scheduledFor: e.scheduledFor.toISOString(),
        status: e.status,
        sentAt: e.sentAt?.toISOString(),
        error: e.error,
      })),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list scheduled emails',
    });
  }
};

/** GET /api/email-integration/scheduled/:id - Get one scheduled email (for editing). */
export const getScheduledEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const doc = await ScheduledEmail.findOne({
      _id: id,
      user: new Types.ObjectId(userId),
    }).lean();
    if (!doc) {
      res.status(404).json({ success: false, message: 'Scheduled email not found' });
      return;
    }
    if (doc.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Can only edit pending scheduled emails' });
      return;
    }
    res.json({
      success: true,
      data: {
        _id: doc._id.toString(),
        to: doc.to,
        subject: doc.subject,
        bodyPlain: doc.bodyPlain ?? '',
        scheduledFor: doc.scheduledFor.toISOString(),
        status: doc.status,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get scheduled email',
    });
  }
};

/** PATCH /api/email-integration/scheduled/:id - Update a pending scheduled email. Body: { to?, subject?, bodyPlain?, scheduledFor? }. */
export const updateScheduledEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const doc = await ScheduledEmail.findOne({
      _id: id,
      user: new Types.ObjectId(userId),
    });
    if (!doc) {
      res.status(404).json({ success: false, message: 'Scheduled email not found' });
      return;
    }
    if (doc.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Can only edit pending scheduled emails' });
      return;
    }
    const { to, subject, bodyPlain, scheduledFor: scheduledForRaw } = req.body as {
      to?: string;
      subject?: string;
      bodyPlain?: string;
      scheduledFor?: string;
    };
    if (to !== undefined) doc.to = String(to).trim();
    if (subject !== undefined) doc.subject = String(subject).trim();
    if (bodyPlain !== undefined) doc.bodyPlain = String(bodyPlain);
    if (scheduledForRaw !== undefined) {
      const scheduledFor = new Date(scheduledForRaw);
      if (Number.isNaN(scheduledFor.getTime())) {
        res.status(400).json({ success: false, message: 'scheduledFor must be a valid date/time (ISO string)' });
        return;
      }
      if (scheduledFor.getTime() <= Date.now()) {
        res.status(400).json({ success: false, message: 'scheduledFor must be in the future' });
        return;
      }
      doc.scheduledFor = scheduledFor;
    }
    await doc.save();
    res.json({
      success: true,
      data: {
        _id: doc._id.toString(),
        to: doc.to,
        subject: doc.subject,
        scheduledFor: doc.scheduledFor.toISOString(),
        status: doc.status,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to update scheduled email',
    });
  }
};

/** DELETE /api/email-integration/scheduled/:id - Delete/cancel a scheduled email (pending only). */
export const deleteScheduledEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const doc = await ScheduledEmail.findOneAndDelete({
      _id: id,
      user: new Types.ObjectId(userId),
      status: 'pending',
    });
    if (!doc) {
      res.status(404).json({
        success: false,
        message: 'Scheduled email not found or already sent/cannot be cancelled',
      });
      return;
    }
    res.json({ success: true, message: 'Scheduled email cancelled' });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to delete scheduled email',
    });
  }
};
