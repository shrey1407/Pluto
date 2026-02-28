import { Response } from 'express';
import { Types } from 'mongoose';
import { Post, PostLike, PostBookmark } from '../../models';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AGORA_FEED_PAGE_SIZE } from '../../utils/constants';
import { listPosts } from './posts.controller';

/** GET /api/agora/feed - Home feed = posts from followed users. */
export const getHomeFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  req.query.following = 'true';
  return listPosts(req, res);
};

/** GET /api/agora/feed/trending - Trending = most liked posts. */
export const getTrendingFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_FEED_PAGE_SIZE)
    );
    const skip = (page - 1) * limit;

    const filter = {
      parentPost: { $in: [null, undefined] },
      hidden: { $ne: true },
    };
    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('user', 'username email profilePicture')
        .sort({ likesCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    let likedSet = new Set<string>();
    let bookmarkedSet = new Set<string>();
    if (userId && posts.length > 0) {
      const postIds = posts.map((p) => p._id);
      const [likes, bookmarks] = await Promise.all([
        PostLike.find({ user: new Types.ObjectId(userId), post: { $in: postIds } })
          .select('post')
          .lean(),
        PostBookmark.find({ user: new Types.ObjectId(userId), post: { $in: postIds } })
          .select('post')
          .lean(),
      ]);
      likedSet = new Set(likes.map((l) => String(l.post)));
      bookmarkedSet = new Set(bookmarks.map((b) => String(b.post)));
    }

    const items = posts.map((p) => ({
      ...p,
      likedByCurrentUser: likedSet.has(String(p._id)),
      bookmarkedByCurrentUser: bookmarkedSet.has(String(p._id)),
    }));

    res.json({
      success: true,
      data: {
        posts: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get trending feed',
    });
  }
};

/** GET /api/agora/feed/user/:id or /users/:id/posts - Posts by a user (top-level). */
export const getUserPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  req.query.author = req.params.id;
  req.query.parentPost = 'null';
  return listPosts(req, res);
};
