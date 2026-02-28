import crypto from 'crypto';
import { Response } from 'express';
import { Types } from 'mongoose';
import {
  User,
  LoyaltyTransaction,
  PulseBotLinkCode,
  PulseBotLink,
  PulseBotMessage,
} from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  PULSEBOT_LINK_CODE_EXPIRY_MINUTES,
  COST_PULSEBOT_SUMMARY,
  COST_PULSEBOT_ASK,
  COST_PULSEBOT_STATS,
  PULSEBOT_SUMMARY_HOURS,
} from '../utils/constants';
import { cacheGet, cacheSet, CACHE_TTL } from '../utils/redis.cache';
import {
  sendTelegramMessage,
  parseTelegramUpdate,
  isGroupChat,
  registerWebhook,
} from '../services/telegramBot.service';
import { generateWithGemini } from '../trendcraft/services/gemini.service';

const PULSEBOT_ASK_CACHE_TTL = CACHE_TTL.PULSEBOT_ASK_MINUTES * 60;

const BOT_USERNAME = 'Pluto_PulseBot';
const LINK_CODE_LENGTH = 6;

function generateLinkCode(): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

/** Get chat context (messages) for linked user in last 12 hours from their groups and channels. */
async function getChatContextForUser(telegramUserId: number): Promise<string> {
  const since = new Date(Date.now() - PULSEBOT_SUMMARY_HOURS * 60 * 60 * 1000);

  const userGroups = await PulseBotMessage.distinct('groupTelegramId', {
    fromTelegramUserId: telegramUserId,
    messageDate: { $gte: since },
  });
  const channelIds = await PulseBotMessage.distinct('groupTelegramId', {
    fromTelegramUserId: 0,
    messageDate: { $gte: since },
  });
  const chatIds = [...new Set([...userGroups, ...channelIds])];

  if (chatIds.length === 0) {
    return '';
  }

  const messages = await PulseBotMessage.find({
    groupTelegramId: { $in: chatIds },
    messageDate: { $gte: since },
  })
    .sort({ messageDate: 1 })
    .lean();

  const lines: string[] = [];
  let lastGroup = '';
  for (const m of messages) {
    if (m.groupTelegramId !== lastGroup) {
      lastGroup = m.groupTelegramId;
      const label = m.fromTelegramUserId === 0 ? 'Channel' : 'Group';
      lines.push(`\n[${label}: ${m.groupTitle || m.groupTelegramId}]`);
    }
    const user = m.fromUsername ? `@${m.fromUsername}` : `User${m.fromTelegramUserId}`;
    const time = new Date(m.messageDate).toISOString();
    lines.push(`${time} ${user}: ${m.text}`);
  }
  return lines.join('\n').trim();
}

/** Deduct loyalty for PulseBot AI feature. */
async function deductPulseBotPoints(
  userId: string,
  cost: number
): Promise<{ ok: boolean; newBalance?: number }> {
  const user = await User.findById(userId);
  if (!user) return { ok: false };
  if (user.loyaltyPoints < cost) return { ok: false };
  const newBalance = user.loyaltyPoints - cost;
  await User.findByIdAndUpdate(userId, { loyaltyPoints: newBalance });
  await LoyaltyTransaction.create({
    user: new Types.ObjectId(userId),
    type: 'feature_use',
    amount: -cost,
    balanceAfter: newBalance,
    referenceType: 'Feature',
    metadata: { feature: 'pulsebot' },
  });
  return { ok: true, newBalance };
}

/**
 * POST /api/pulsebot/link-code - Generate a one-time code to link Telegram. Requires auth.
 */
export const createLinkCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + PULSEBOT_LINK_CODE_EXPIRY_MINUTES * 60 * 1000);

    await PulseBotLinkCode.create({
      user: new Types.ObjectId(userId),
      code,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      data: {
        code,
        botUsername: BOT_USERNAME,
        botUrl: `https://t.me/${BOT_USERNAME}`,
        instructions: `Send this in Telegram to @${BOT_USERNAME}: /link ${code}`,
        expiresInMinutes: PULSEBOT_LINK_CODE_EXPIRY_MINUTES,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to create link code',
    });
  }
};

/**
 * GET /api/pulsebot/set-webhook - Register webhook URL with Telegram. Call once when backend is publicly reachable.
 * Requires PULSEBOT_WEBHOOK_BASE_URL in env (e.g. https://xxx.ngrok.io).
 */
export const setWebhook = async (_req: unknown, res: Response): Promise<void> => {
  try {
    const result = await registerWebhook();
    if (result.ok) {
      res.json({ success: true, message: 'Webhook set', url: result.url });
    } else {
      res.status(400).json({ success: false, message: result.error ?? 'Failed to set webhook' });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to set webhook',
    });
  }
};

/**
 * POST /api/pulsebot/webhook - Telegram sends updates here. Public; validate by secret_token if set.
 */
export const webhook = async (req: { body: unknown }, res: Response): Promise<void> => {
  try {
    const update = parseTelegramUpdate(req.body);
    const msg = update?.message ?? update?.channel_post;
    if (!msg) {
      res.sendStatus(200);
      return;
    }

    const chatId = msg.chat.id;
    const text = msg.text?.trim() ?? '';
    const isChannelPost = !!update?.channel_post;
    const from = msg.from;
    const telegramUserId = from?.id ?? 0;
    const telegramUsername = from?.username ?? (isChannelPost ? '[Channel]' : undefined);

    if (isChannelPost && !from) {
      // channel_post: store and ack; no /link or replies
      if (text && isGroupChat(chatId)) {
        await PulseBotMessage.create({
          groupTelegramId: String(chatId),
          groupTitle: msg.chat.title,
          fromTelegramUserId: 0,
          fromUsername: '[Channel]',
          text,
          messageDate: new Date(msg.date * 1000),
          telegramMessageId: msg.message_id,
        });
      }
      console.log('[PulseBot] Webhook: channel_post chatId=%s text=%s', chatId, text ? `"${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"` : '(no text)');
      res.sendStatus(200);
      return;
    }

    if (!from) {
      res.sendStatus(200);
      return;
    }

    console.log('[PulseBot] Webhook: chatId=%s text=%s', chatId, text ? `"${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"` : '(no text)');

    if (isGroupChat(chatId)) {
      if (text) {
        await PulseBotMessage.create({
          groupTelegramId: String(chatId),
          groupTitle: msg.chat.title,
          fromTelegramUserId: telegramUserId,
          fromUsername: telegramUsername,
          text,
          messageDate: new Date(msg.date * 1000),
          telegramMessageId: msg.message_id,
        });
      }
      res.sendStatus(200);
      return;
    }

    if (text.startsWith('/link ')) {
      const code = text.slice(6).trim();
      const linkCodeDoc = await PulseBotLinkCode.findOne({
        code,
        expiresAt: { $gt: new Date() },
      });

      if (!linkCodeDoc) {
        console.log('[PulseBot] /link code=%s: invalid or expired', code);
        await sendTelegramMessage(
          chatId,
          'Invalid or expired code. Generate a new code in the Pluto app and try again.'
        );
        res.sendStatus(200);
        return;
      }

      const existing = await PulseBotLink.findOne({
        $or: [
          { user: linkCodeDoc.user },
          { telegramUserId },
        ],
      });
      if (existing) {
        console.log('[PulseBot] /link code=%s: already linked or code used', code);
        if (existing.telegramUserId === telegramUserId) {
          await sendTelegramMessage(chatId, 'This Telegram account is already linked to your Pluto account.');
        } else {
          await sendTelegramMessage(chatId, 'This code was already used or your app account is linked to another Telegram.');
        }
        res.sendStatus(200);
        return;
      }

      await PulseBotLink.create({
        user: linkCodeDoc.user,
        telegramUserId,
        telegramUsername,
        telegramChatId: chatId,
      });
      await PulseBotLinkCode.deleteOne({ _id: linkCodeDoc._id });
      console.log('[PulseBot] /link code=%s: linked successfully', code);

      await sendTelegramMessage(
        chatId,
        '✅ Linked! Add this bot to your Telegram groups to provide chat context. Then use the Pluto app to generate summaries and Q&A.'
      );
      res.sendStatus(200);
      return;
    }

    if (text === '/start' || text === '/link') {
      await sendTelegramMessage(
        chatId,
        `Welcome to Pluto PulseBot. To link your account:\n1. Open the Pluto app and go to PulseBot\n2. Tap "Link Telegram" and get your code\n3. Send: /link YOUR_CODE\n\nThen add this bot to your groups to enable chat summaries.`
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('PulseBot webhook error:', err);
    res.sendStatus(200);
  }
};

/**
 * GET /api/pulsebot/me - Link status and groups user participates in. Requires auth.
 */
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const link = await PulseBotLink.findOne({ user: new Types.ObjectId(userId) }).lean();

    if (!link) {
      res.json({
        success: true,
        data: {
          linked: false,
          telegramUsername: null,
          groups: [],
        },
      });
      return;
    }

    const since = new Date(Date.now() - PULSEBOT_SUMMARY_HOURS * 60 * 60 * 1000);
    const groupIds = await PulseBotMessage.distinct('groupTelegramId', {
      fromTelegramUserId: link.telegramUserId,
      messageDate: { $gte: since },
    });

    const groupTitles = await PulseBotMessage.aggregate([
      { $match: { groupTelegramId: { $in: groupIds } } },
      { $group: { _id: '$groupTelegramId', title: { $first: '$groupTitle' } } },
    ]);

    const groups = groupTitles.map((g) => ({
      groupTelegramId: g._id,
      title: g.title || g._id,
    }));

    res.json({
      success: true,
      data: {
        linked: true,
        telegramUsername: link.telegramUsername ?? null,
        groups,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get PulseBot status',
    });
  }
};

/**
 * POST /api/pulsebot/summary - Generate summary of chats in last 12 hours. Requires auth, costs loyalty.
 */
export const generateSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const link = await PulseBotLink.findOne({ user: new Types.ObjectId(userId) });
    if (!link) {
      res.status(400).json({
        success: false,
        message: 'Link your Telegram first. Use the app to get a link code and send /link CODE to the bot.',
      });
      return;
    }

    const deduction = await deductPulseBotPoints(userId, COST_PULSEBOT_SUMMARY);
    if (!deduction.ok) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. This action costs ${COST_PULSEBOT_SUMMARY} points.`,
      });
      return;
    }

    const context = await getChatContextForUser(link.telegramUserId);
    if (!context) {
      res.json({
        success: true,
        data: {
          summary: 'No chat activity in your linked groups in the last 12 hours.',
          loyaltyPointsDeducted: COST_PULSEBOT_SUMMARY,
          newBalance: deduction.newBalance,
        },
      });
      return;
    }

    const prompt = `You are a helpful assistant. Below is a transcript of Telegram group chats (last ${PULSEBOT_SUMMARY_HOURS} hours).

Your task: Write a COMPLETE summary. You MUST cover EVERY main topic mentioned in the transcript. For each topic, include 2–4 bullet points or short paragraphs with the key points, decisions, and notable quotes or outcomes. Do not stop after the first topic—continue until all major themes are summarized. Do not invent or add information not in the transcript. Use clear headings (e.g. **Topic name**) and bullet points for readability.

---\n${context}\n---\n\nSummary:`;

    const summary = await generateWithGemini(prompt, { maxOutputTokens: 4096 });
    if (!summary) {
      res.status(503).json({
        success: false,
        message: 'Summary generation unavailable. Check GEMINI_API_KEY.',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        summary,
        loyaltyPointsDeducted: COST_PULSEBOT_SUMMARY,
        newBalance: deduction.newBalance,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to generate summary',
    });
  }
};

function hashMessages(question: string, context: string): string {
  return crypto.createHash('sha256').update(question + '\n' + context).digest('hex');
}

/**
 * POST /api/pulsebot/ask - Q&A over chat context (last 12 hours). Requires auth, costs loyalty.
 * Body: { question: string }
 */
export const ask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const question = (req.body.question as string)?.trim();
    if (!question) {
      res.status(400).json({ success: false, message: 'question is required in body' });
      return;
    }

    const link = await PulseBotLink.findOne({ user: new Types.ObjectId(userId) });
    if (!link) {
      res.status(400).json({
        success: false,
        message: 'Link your Telegram first.',
      });
      return;
    }

    const context = await getChatContextForUser(link.telegramUserId);
    if (!context) {
      const deduction = await deductPulseBotPoints(userId, COST_PULSEBOT_ASK);
      if (!deduction.ok) {
        res.status(400).json({
          success: false,
          message: `Insufficient loyalty points. This action costs ${COST_PULSEBOT_ASK} points.`,
        });
        return;
      }
      res.json({
        success: true,
        data: {
          answer: 'No chat activity in the last 12 hours to answer from.',
          loyaltyPointsDeducted: COST_PULSEBOT_ASK,
          newBalance: deduction.newBalance,
        },
      });
      return;
    }

    const messageHash = hashMessages(question, context);
    const cacheKey = `pulsebot:ask:${userId}:${messageHash}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      try {
        const { answer } = JSON.parse(cached) as { answer: string };
        const user = await User.findById(userId);
        const newBalance = user?.loyaltyPoints ?? 0;
        res.json({
          success: true,
          data: {
            answer,
            loyaltyPointsDeducted: 0,
            newBalance,
          },
        });
        return;
      } catch {
        // invalid cache, fall through
      }
    }

    const deduction = await deductPulseBotPoints(userId, COST_PULSEBOT_ASK);
    if (!deduction.ok) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. This action costs ${COST_PULSEBOT_ASK} points.`,
      });
      return;
    }

    const prompt = `You are a helpful assistant. Below is a transcript of Telegram group chats (last ${PULSEBOT_SUMMARY_HOURS} hours). Answer the user's question based ONLY on this context. If the answer is not in the transcript, say so.\n\n---\n${context}\n---\n\nQuestion: ${question}\n\nAnswer:`;

    const answer = await generateWithGemini(prompt);
    if (!answer) {
      res.status(503).json({
        success: false,
        message: 'Q&A unavailable. Check GEMINI_API_KEY.',
      });
      return;
    }

    await cacheSet(cacheKey, JSON.stringify({ answer }), PULSEBOT_ASK_CACHE_TTL);

    res.json({
      success: true,
      data: {
        answer,
        loyaltyPointsDeducted: COST_PULSEBOT_ASK,
        newBalance: deduction.newBalance,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to answer question',
    });
  }
};

/**
 * GET /api/pulsebot/digest - Non-AI Telegram digest (no loyalty cost). Requires Telegram linked.
 * Returns: totalMessages, topGroupsByMessageCount, lastActivityAt, mostActiveSender, periodHours.
 */
export const getTelegramDigest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const link = await PulseBotLink.findOne({ user: new Types.ObjectId(userId) });
    if (!link) {
      res.status(400).json({
        success: false,
        message: 'Link your Telegram first.',
      });
      return;
    }

    const since = new Date(Date.now() - PULSEBOT_SUMMARY_HOURS * 60 * 60 * 1000);
    const userGroupIds = await PulseBotMessage.distinct('groupTelegramId', {
      fromTelegramUserId: link.telegramUserId,
      messageDate: { $gte: since },
    });

    if (userGroupIds.length === 0) {
      res.json({
        success: true,
        data: {
          totalMessages: 0,
          topGroupsByMessageCount: [],
          lastActivityAt: null,
          mostActiveSender: null,
          periodHours: PULSEBOT_SUMMARY_HOURS,
        },
      });
      return;
    }

    const [totalResult, groupInfo, lastActivity, mostActive] = await Promise.all([
      PulseBotMessage.countDocuments({
        groupTelegramId: { $in: userGroupIds },
        messageDate: { $gte: since },
      }),
      PulseBotMessage.aggregate<{ _id: string; title?: string; totalMessages: number }>([
        { $match: { groupTelegramId: { $in: userGroupIds }, messageDate: { $gte: since } } },
        { $group: { _id: '$groupTelegramId', title: { $first: '$groupTitle' }, totalMessages: { $sum: 1 } } },
        { $sort: { totalMessages: -1 } },
        { $limit: 5 },
      ]),
      PulseBotMessage.findOne(
        { groupTelegramId: { $in: userGroupIds }, messageDate: { $gte: since } },
        { sort: { messageDate: -1 }, projection: { messageDate: 1 } }
      ).lean(),
      PulseBotMessage.aggregate<{ _id: { fromTelegramUserId: number; fromUsername?: string }; count: number }>([
        { $match: { groupTelegramId: { $in: userGroupIds }, messageDate: { $gte: since } } },
        { $group: { _id: { fromTelegramUserId: '$fromTelegramUserId', fromUsername: '$fromUsername' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

    const topGroups = groupInfo.map((g) => ({
      groupTelegramId: g._id,
      groupTitle: g.title || g._id,
      messageCount: g.totalMessages,
    }));

    const mostActiveSender = mostActive[0]
      ? {
          username: mostActive[0]._id.fromUsername ? `@${mostActive[0]._id.fromUsername}` : null,
          telegramUserId: mostActive[0]._id.fromTelegramUserId,
          count: mostActive[0].count,
        }
      : null;

    res.json({
      success: true,
      data: {
        totalMessages: totalResult,
        topGroupsByMessageCount: topGroups,
        lastActivityAt: lastActivity?.messageDate ? new Date(lastActivity.messageDate).toISOString() : null,
        mostActiveSender,
        periodHours: PULSEBOT_SUMMARY_HOURS,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get Telegram digest',
    });
  }
};

/**
 * GET /api/pulsebot/stats - Group activity stats (non-AI). Requires auth, costs COST_PULSEBOT_STATS loyalty points.
 * Returns message counts per group, per user in groups the linked user is in (last 12h).
 */
export const getStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const link = await PulseBotLink.findOne({ user: new Types.ObjectId(userId) });
    if (!link) {
      res.status(400).json({
        success: false,
        message: 'Link your Telegram first.',
      });
      return;
    }

    const deduction = await deductPulseBotPoints(userId, COST_PULSEBOT_STATS);
    if (!deduction.ok) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. Group activity costs ${COST_PULSEBOT_STATS} points.`,
      });
      return;
    }

    const since = new Date(Date.now() - PULSEBOT_SUMMARY_HOURS * 60 * 60 * 1000);
    const userGroupIds = await PulseBotMessage.distinct('groupTelegramId', {
      fromTelegramUserId: link.telegramUserId,
      messageDate: { $gte: since },
    });

    if (userGroupIds.length === 0) {
      res.json({
        success: true,
        data: {
          groups: [],
          periodHours: PULSEBOT_SUMMARY_HOURS,
          newBalance: deduction.newBalance,
        },
      });
      return;
    }

    const groupInfo = await PulseBotMessage.aggregate([
      { $match: { groupTelegramId: { $in: userGroupIds }, messageDate: { $gte: since } } },
      { $group: { _id: '$groupTelegramId', title: { $first: '$groupTitle' }, totalMessages: { $sum: 1 } } },
    ]);

    const byUser = await PulseBotMessage.aggregate([
      { $match: { groupTelegramId: { $in: userGroupIds }, messageDate: { $gte: since } } },
      {
        $group: {
          _id: { group: '$groupTelegramId', fromTelegramUserId: '$fromTelegramUserId', fromUsername: '$fromUsername' },
          count: { $sum: 1 },
        },
      },
    ]);

    const groups = groupInfo.map((g) => {
      const users = byUser
        .filter((u) => u._id.group === g._id)
        .map((u) => ({
          telegramUserId: u._id.fromTelegramUserId,
          username: u._id.fromUsername ? `@${u._id.fromUsername}` : null,
          messageCount: u.count,
        }))
        .sort((a, b) => b.messageCount - a.messageCount);
      return {
        groupTelegramId: g._id,
        title: g.title || g._id,
        totalMessages: g.totalMessages,
        topParticipants: users.slice(0, 10),
      };
    });

    res.json({
      success: true,
      data: {
        groups,
        periodHours: PULSEBOT_SUMMARY_HOURS,
        newBalance: deduction.newBalance,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get stats',
    });
  }
};
