import { Response } from 'express';
import { Types } from 'mongoose';
import { User, DailyClaim, LoyaltyTransaction } from '../models';
import { DAILY_CLAIM_POINTS } from '../models/DailyClaim';
import { AuthRequest } from '../middleware/auth.middleware';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/** GET /api/daily-claim/status - Get daily claim status (next claim time, current streak). */
export const getStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const user = await User.findById(userId).select('lastDailyClaimAt dailyClaimStreak').lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const now = Date.now();
    const lastAt = user.lastDailyClaimAt ? new Date(user.lastDailyClaimAt).getTime() : null;
    const nextClaimAt = lastAt ? new Date(lastAt + TWENTY_FOUR_HOURS_MS) : null;
    const canClaim = !lastAt || now - lastAt >= TWENTY_FOUR_HOURS_MS;

    let nextDayNumber = 1;
    if (lastAt) {
      const diff = now - lastAt;
      if (diff >= FORTY_EIGHT_HOURS_MS) {
        nextDayNumber = 1;
      } else if (diff >= TWENTY_FOUR_HOURS_MS) {
        nextDayNumber = Math.min((user.dailyClaimStreak ?? 0) + 1, 7);
      }
    }

    res.json({
      success: true,
      data: {
        canClaim,
        currentStreak: user.dailyClaimStreak ?? 0,
        nextDayNumber: canClaim ? nextDayNumber : null,
        nextClaimAt: canClaim ? null : nextClaimAt,
        pointsForNextClaim: canClaim ? DAILY_CLAIM_POINTS[nextDayNumber - 1]! : null,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get daily claim status',
    });
  }
};

/** POST /api/daily-claim - Claim daily loyalty points (once per 24h, streak 1–7). */
export const claim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const now = Date.now();
    const lastAt = user.lastDailyClaimAt ? new Date(user.lastDailyClaimAt).getTime() : null;

    if (lastAt && now - lastAt < TWENTY_FOUR_HOURS_MS) {
      const nextAt = new Date(lastAt + TWENTY_FOUR_HOURS_MS);
      res.status(400).json({
        success: false,
        message: 'You can claim again after 24 hours',
        data: { nextClaimAt: nextAt },
      });
      return;
    }

    let dayNumber: number;
    if (!lastAt) {
      dayNumber = 1;
    } else {
      const diff = now - lastAt;
      if (diff >= FORTY_EIGHT_HOURS_MS) {
        dayNumber = 1;
      } else {
        dayNumber = Math.min((user.dailyClaimStreak ?? 0) + 1, 7);
      }
    }

    const points = DAILY_CLAIM_POINTS[dayNumber - 1] ?? 10;
    const newBalance = user.loyaltyPoints + points;

    await User.findByIdAndUpdate(userId, {
      loyaltyPoints: newBalance,
      dailyClaimStreak: dayNumber,
      lastDailyClaimAt: new Date(),
    });

    const dailyClaim = await DailyClaim.create({
      user: new Types.ObjectId(userId),
      dayNumber,
      pointsClaimed: points,
      claimedAt: new Date(),
    });

    await LoyaltyTransaction.create({
      user: new Types.ObjectId(userId),
      type: 'daily_claim',
      amount: points,
      balanceAfter: newBalance,
      referenceType: 'DailyClaim',
      referenceId: dailyClaim._id,
      metadata: { dayNumber },
    });

    res.json({
      success: true,
      data: {
        pointsClaimed: points,
        dayNumber,
        newBalance,
        nextClaimAt: new Date(now + TWENTY_FOUR_HOURS_MS),
      },
      message: `Claimed ${points} loyalty points (day ${dayNumber})`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to claim',
    });
  }
};
