import { Response } from 'express';
import { Types } from 'mongoose';
import { User, Follow, Post, PostLike, PostBookmark, LoyaltyTransaction } from '../../models';
import { AuthRequest } from '../../middleware/auth.middleware';
import {
  AGORA_USERS_PAGE_SIZE,
  AGORA_FOLLOW_PAGE_SIZE,
  AGORA_MOST_TIPPED_PAGE_SIZE,
  MIN_TIP_AMOUNT,
  MAX_TIP_AMOUNT,
} from '../../utils/constants';
import { createAgoraNotification } from '../notificationService';

/** GET /api/agora/users/most-tipped - List users by total tips received (casts + profile tips). Paginated. */
export const getMostTippedUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_MOST_TIPPED_PAGE_SIZE)
    );
    const skip = (page - 1) * limit;

    const aggregated = await LoyaltyTransaction.aggregate([
      { $match: { type: 'tip_received', referenceType: { $in: ['Post', 'User'] } } },
      { $group: { _id: '$user', totalReceived: { $sum: '$amount' } } },
      { $sort: { totalReceived: -1 } },
      { $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      } },
    ]);

    const items = aggregated[0]?.items ?? [];
    const total = aggregated[0]?.total?.[0]?.count ?? 0;
    const userIds = items.map((i: { _id: Types.ObjectId }) => i._id);

    const users = await User.find({ _id: { $in: userIds } })
      .select('_id username email profilePicture referralCode')
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const list = items.map((i: { _id: Types.ObjectId; totalReceived: number }) => {
      const u = userMap.get(i._id.toString());
      return {
        user: u
          ? { id: u._id, username: u.username, email: u.email, profilePicture: u.profilePicture, referralCode: u.referralCode }
          : { id: i._id },
        totalTipsReceived: i.totalReceived,
      };
    });

    res.json({
      success: true,
      data: {
        users: list,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list most tipped users',
    });
  }
};

/** GET /api/agora/users - List all users (for search). Paginated, optional q for username/email search. */
export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_USERS_PAGE_SIZE)
    );
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const filter: Record<string, unknown> = {};
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const prefix = new RegExp(`^${escaped}`, 'i');
      filter.$or = [
        { username: prefix },
        { email: prefix },
        { referralCode: prefix },
      ];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('_id username email referralCode profilePicture')
        .sort({ username: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const items = users.map((u) => ({
      id: u._id,
      username: u.username,
      email: u.email,
      referralCode: u.referralCode,
      profilePicture: u.profilePicture,
    }));

    res.json({
      success: true,
      data: {
        users: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list users',
    });
  }
};

/** GET /api/agora/users/:id - User public profile. */
export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid user id' });
      return;
    }

    const user = await User.findById(id)
      .select('-passwordHash')
      .lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const userIdObj = new Types.ObjectId(id);
    const [followersCount, followingCount, postsCount, isFollowing] = await Promise.all([
      Follow.countDocuments({ following: userIdObj }),
      Follow.countDocuments({ follower: userIdObj }),
      Post.countDocuments({ user: userIdObj, parentPost: { $in: [null, undefined] } }),
      currentUserId
        ? Follow.findOne({ follower: new Types.ObjectId(currentUserId), following: userIdObj }).then((r) => !!r)
        : Promise.resolve(false),
    ]);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          referralCode: user.referralCode,
          createdAt: user.createdAt,
          profilePicture: (user as { profilePicture?: string }).profilePicture,
          walletAddress: (user as { walletAddress?: string }).walletAddress,
        },
        profile: {
          followersCount,
          followingCount,
          postsCount,
          isFollowingByCurrentUser: isFollowing,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get profile',
    });
  }
};

/** PATCH /api/agora/users/me - Update current user profile. */
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { username } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (username !== undefined) {
      if (typeof username !== 'string') {
        res.status(400).json({ success: false, message: 'username must be a string' });
        return;
      }
      user.username = username.trim() || undefined;
    }

    await user.save();
    const updated = await User.findById(userId)
      .select('-passwordHash')
      .lean();

    res.json({
      success: true,
      data: { user: updated },
      message: 'Profile updated',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to update profile',
    });
  }
};

/** POST /api/agora/users/:id/tip - Tip loyalty points directly to a user (from profile). */
export const tipUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id: targetId } = req.params;
    const amount = req.body.amount != null ? Number(req.body.amount) : NaN;

    if (!Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ success: false, message: 'Invalid user id' });
      return;
    }

    if (!Number.isInteger(amount) || amount < MIN_TIP_AMOUNT || amount > MAX_TIP_AMOUNT) {
      res.status(400).json({
        success: false,
        message: `Amount must be an integer between ${MIN_TIP_AMOUNT} and ${MAX_TIP_AMOUNT}`,
      });
      return;
    }

    if (targetId === userId) {
      res.status(400).json({ success: false, message: 'Cannot tip yourself' });
      return;
    }

    const [tipper, recipient] = await Promise.all([
      User.findById(userId),
      User.findById(targetId),
    ]);

    if (!tipper || !recipient) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (tipper.loyaltyPoints < amount) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. Available: ${tipper.loyaltyPoints}`,
      });
      return;
    }

    const tipperNewBalance = tipper.loyaltyPoints - amount;
    const recipientNewBalance = recipient.loyaltyPoints + amount;

    await User.findByIdAndUpdate(userId, { loyaltyPoints: tipperNewBalance });
    await User.findByIdAndUpdate(targetId, { loyaltyPoints: recipientNewBalance });

    await LoyaltyTransaction.create([
      {
        user: new Types.ObjectId(userId),
        type: 'tip_sent',
        amount: -amount,
        balanceAfter: tipperNewBalance,
        referenceType: 'User',
        referenceId: new Types.ObjectId(targetId),
        metadata: { recipientId: targetId },
      },
      {
        user: new Types.ObjectId(targetId),
        type: 'tip_received',
        amount,
        balanceAfter: recipientNewBalance,
        referenceType: 'User',
        referenceId: new Types.ObjectId(targetId),
        metadata: { fromUserId: userId },
      },
    ]);

    await createAgoraNotification(
      targetId,
      'tip',
      userId,
      'User',
      new Types.ObjectId(targetId),
      { amount }
    );

    res.json({
      success: true,
      data: {
        amount,
        recipientId: targetId,
        yourNewBalance: tipperNewBalance,
      },
      message: `Tipped ${amount} loyalty points`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to tip',
    });
  }
};

/** POST /api/agora/users/:id/follow - Follow a user. */
export const followUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id: targetId } = req.params;

    if (!Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ success: false, message: 'Invalid user id' });
      return;
    }

    if (targetId === userId) {
      res.status(400).json({ success: false, message: 'Cannot follow yourself' });
      return;
    }

    const target = await User.findById(targetId);
    if (!target) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const existing = await Follow.findOne({
      follower: new Types.ObjectId(userId),
      following: new Types.ObjectId(targetId),
    });

    if (existing) {
      res.json({
        success: true,
        data: { following: true, userId: targetId },
        message: 'Already following',
      });
      return;
    }

    await Follow.create({
      follower: new Types.ObjectId(userId),
      following: new Types.ObjectId(targetId),
    });

    await createAgoraNotification(
      targetId,
      'follow',
      userId,
      'User',
      new Types.ObjectId(targetId)
    );

    res.status(201).json({
      success: true,
      data: { following: true, userId: targetId },
      message: 'User followed',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to follow user',
    });
  }
};

/** DELETE /api/agora/users/:id/follow - Unfollow a user. */
export const unfollowUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id: targetId } = req.params;

    if (!Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ success: false, message: 'Invalid user id' });
      return;
    }

    const deleted = await Follow.findOneAndDelete({
      follower: new Types.ObjectId(userId),
      following: new Types.ObjectId(targetId),
    });

    res.json({
      success: true,
      data: { following: false, userId: targetId },
      message: deleted ? 'User unfollowed' : 'Was not following',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to unfollow user',
    });
  }
};

/** GET /api/agora/users/:id/followers - List users who follow this user. Paginated. */
export const getFollowers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_FOLLOW_PAGE_SIZE)
    );

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid user id' });
      return;
    }

    const skip = (page - 1) * limit;
    const [follows, total] = await Promise.all([
      Follow.find({ following: new Types.ObjectId(id) })
        .populate('follower', 'username email profilePicture referralCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Follow.countDocuments({ following: new Types.ObjectId(id) }),
    ]);

    const userIds = follows.map((f: { follower: { _id: Types.ObjectId } }) => f.follower._id);
    let followedByCurrentUser = new Set<string>();
    const currentUserId = req.user?.id;
    if (currentUserId && userIds.length > 0) {
      const myFollows = await Follow.find({
        follower: new Types.ObjectId(currentUserId),
        following: { $in: userIds },
      })
        .select('following')
        .lean();
      followedByCurrentUser = new Set(myFollows.map((f) => (f.following as Types.ObjectId).toString()));
    }

    const followers = follows.map((f: { follower: { _id?: Types.ObjectId }; createdAt: Date }) => ({
      user: f.follower,
      followedAt: f.createdAt,
      isFollowingByCurrentUser: followedByCurrentUser.has(
        (f.follower?._id ?? '').toString()
      ),
    }));

    res.json({
      success: true,
      data: {
        followers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list followers',
    });
  }
};

/** GET /api/agora/users/:id/following - List users this user follows. Paginated. */
export const getFollowing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_FOLLOW_PAGE_SIZE)
    );

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid user id' });
      return;
    }

    const skip = (page - 1) * limit;
    const [follows, total] = await Promise.all([
      Follow.find({ follower: new Types.ObjectId(id) })
        .populate('following', 'username email profilePicture referralCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Follow.countDocuments({ follower: new Types.ObjectId(id) }),
    ]);

    const userIds = follows.map((f: { following: { _id: Types.ObjectId } }) => f.following._id);
    let followedByCurrentUser = new Set<string>();
    const currentUserId = req.user?.id;
    if (currentUserId && userIds.length > 0) {
      const myFollows = await Follow.find({
        follower: new Types.ObjectId(currentUserId),
        following: { $in: userIds },
      })
        .select('following')
        .lean();
      followedByCurrentUser = new Set(myFollows.map((f) => (f.following as Types.ObjectId).toString()));
    }

    const following = follows.map((f: { following: { _id?: Types.ObjectId }; createdAt: Date }) => ({
      user: f.following,
      followedAt: f.createdAt,
      isFollowingByCurrentUser: followedByCurrentUser.has(
        (f.following?._id ?? '').toString()
      ),
    }));

    res.json({
      success: true,
      data: {
        following,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list following',
    });
  }
};

/** GET /api/agora/users/:id/liked - List posts liked by this user (including own casts if liked). Paginated. */
export const getUserLikedPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_FOLLOW_PAGE_SIZE)
    );

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid user id' });
      return;
    }

    const userIdObj = new Types.ObjectId(id);
    const skip = (page - 1) * limit;

    const pipeline: object[] = [
      { $match: { user: userIdObj } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'posts',
          let: { postId: '$post' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$postId'] },
                hidden: { $ne: true },
                parentPost: { $in: [null, undefined] },
              },
            },
            { $limit: 1 },
          ],
          as: 'postDoc',
        },
      },
      { $match: { postDoc: { $ne: [] } } },
    ];

    const [items, totalResult] = await Promise.all([
      PostLike.aggregate([...pipeline, { $skip: skip }, { $limit: limit }, { $replaceRoot: { newRoot: { $arrayElemAt: ['$postDoc', 0] } } }] as Parameters<typeof PostLike.aggregate>[0]),
      PostLike.aggregate([...pipeline, { $count: 'total' }] as Parameters<typeof PostLike.aggregate>[0]),
    ]);

    const total = (totalResult[0] as { total?: number })?.total ?? 0;
    const posts = items as { _id: Types.ObjectId; user: Types.ObjectId }[];
    const userIds = [...new Set(posts.map((p) => p.user).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } })
      .select('username email profilePicture')
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const ordered = posts.map((p) => {
      const user = userMap.get(String(p.user));
      return { ...p, user: user ?? p.user };
    });

    let likedSet = new Set<string>();
    let bookmarkedSet = new Set<string>();
    if (currentUserId && ordered.length > 0) {
      const postIds = ordered.map((p) => p._id);
      const [likes, bookmarks] = await Promise.all([
        PostLike.find({ user: new Types.ObjectId(currentUserId), post: { $in: postIds } })
          .select('post')
          .lean(),
        PostBookmark.find({ user: new Types.ObjectId(currentUserId), post: { $in: postIds } })
          .select('post')
          .lean(),
      ]);
      likedSet = new Set(likes.map((l) => String(l.post)));
      bookmarkedSet = new Set(bookmarks.map((b) => String(b.post)));
    }

    const result = ordered.map((p) => ({
      ...p,
      likedByCurrentUser: likedSet.has(String(p._id)),
      bookmarkedByCurrentUser: bookmarkedSet.has(String(p._id)),
    }));

    res.json({
      success: true,
      data: {
        posts: result,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list liked posts',
    });
  }
};
