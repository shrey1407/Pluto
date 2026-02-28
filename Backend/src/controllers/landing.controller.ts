import { Request, Response } from 'express';
import { User, Campaign, Quest, QuestCompletion, Feedback } from '../models';

/** GET /api/landing/leaderboard - Top users by loyalty points (public). */
export const getLeaderboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find()
      .select('username email loyaltyPoints profilePicture')
      .sort({ loyaltyPoints: -1 })
      .limit(20)
      .lean();

    const list = users.map((u, i) => ({
      rank: i + 1,
      username: u.username ?? u.email ?? 'Anonymous',
      loyaltyPoints: u.loyaltyPoints ?? 0,
      profilePicture: u.profilePicture ?? null,
    }));

    res.json({ success: true, data: { leaderboard: list } });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to load leaderboard' });
  }
};

/** GET /api/landing/stats - Platform stats (public). */
export const getStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [userCount, campaignCount, questCount, completionCount, totalPoints] = await Promise.all([
      User.countDocuments(),
      Campaign.countDocuments(),
      Quest.countDocuments(),
      QuestCompletion.countDocuments(),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$loyaltyPoints' } } }]).then((r) => r[0]?.total ?? 0),
    ]);

    res.json({
      success: true,
      data: {
        userCount,
        campaignCount,
        questCount,
        completionCount,
        totalPoints,
      },
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
};

/** POST /api/landing/feedback - Submit feedback (public, stored in DB). */
export const submitFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, name, email } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    const feedback = await Feedback.create({
      message: message.trim().slice(0, 2000),
      name: name && typeof name === 'string' ? name.trim().slice(0, 200) : undefined,
      email: email && typeof email === 'string' ? email.trim().toLowerCase().slice(0, 320) : undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback',
      data: { id: feedback._id },
    });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit feedback' });
  }
};
