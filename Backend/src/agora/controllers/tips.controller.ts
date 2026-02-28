import { Response } from 'express';
import { Types } from 'mongoose';
import { LoyaltyTransaction } from '../../models';
import { AuthRequest } from '../../middleware/auth.middleware';

const tipSentFilter = {
  user: null as unknown as Types.ObjectId,
  type: 'tip_sent' as const,
  referenceType: { $in: ['Post', 'User'] as const[] },
};

const tipReceivedFilter = {
  user: null as unknown as Types.ObjectId,
  type: 'tip_received' as const,
  referenceType: { $in: ['Post', 'User'] as const[] },
};

/** GET /api/agora/me/tips/sent - List tips sent by current user (posts + profile). */
export const listSentTips = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { ...tipSentFilter, user: new Types.ObjectId(userId) };

    const [tips, total] = await Promise.all([
      LoyaltyTransaction.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            let: { recId: '$metadata.recipientId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', { $convert: { input: '$$recId', to: 'objectId', onError: null, onNull: null } }] } } },
              { $project: { username: 1, email: 1, profilePicture: 1 } },
            ],
            as: 'recipientUser',
          },
        },
        { $unwind: { path: '$recipientUser', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'posts',
            localField: 'referenceId',
            foreignField: '_id',
            as: 'refPost',
            pipeline: [{ $project: { content: 1 } }],
          },
        },
        { $unwind: { path: '$refPost', preserveNullAndEmptyArrays: true } },
      ]),
      LoyaltyTransaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        tips: tips.map((t) => ({
          id: t._id,
          amount: Math.abs(t.amount),
          referenceType: t.referenceType,
          postId: t.referenceType === 'Post' ? t.referenceId?.toString() : undefined,
          recipientId: t.metadata?.recipientId?.toString(),
          recipient: t.recipientUser
            ? { _id: t.recipientUser._id, username: t.recipientUser.username, email: t.recipientUser.email, profilePicture: t.recipientUser.profilePicture }
            : undefined,
          postPreview: t.refPost?.content?.slice(0, 80),
          createdAt: t.createdAt,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list sent tips',
    });
  }
};

/** GET /api/agora/me/tips/received - List tips received by current user (posts + profile). */
export const listReceivedTips = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { ...tipReceivedFilter, user: new Types.ObjectId(userId) };

    const [tips, total] = await Promise.all([
      LoyaltyTransaction.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            let: { fromId: '$metadata.fromUserId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', { $convert: { input: '$$fromId', to: 'objectId', onError: null, onNull: null } }] } } },
              { $project: { username: 1, email: 1, profilePicture: 1 } },
            ],
            as: 'fromUser',
          },
        },
        { $unwind: { path: '$fromUser', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'posts',
            localField: 'referenceId',
            foreignField: '_id',
            as: 'refPost',
            pipeline: [{ $project: { content: 1 } }],
          },
        },
        { $unwind: { path: '$refPost', preserveNullAndEmptyArrays: true } },
      ]),
      LoyaltyTransaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        tips: tips.map((t) => ({
          id: t._id,
          amount: t.amount,
          referenceType: t.referenceType,
          postId: t.referenceType === 'Post' ? t.referenceId?.toString() : undefined,
          fromUserId: t.metadata?.fromUserId?.toString(),
          fromUser: t.fromUser
            ? { _id: t.fromUser._id, username: t.fromUser.username, email: t.fromUser.email, profilePicture: t.fromUser.profilePicture }
            : undefined,
          postPreview: t.refPost?.content?.slice(0, 80),
          createdAt: t.createdAt,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list received tips',
    });
  }
};
