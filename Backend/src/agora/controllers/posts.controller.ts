import { Response } from 'express';
import { Types } from 'mongoose';
import { Post, PostLike, PostBookmark, Follow, User, LoyaltyTransaction } from '../../models';
import { AuthRequest } from '../../middleware/auth.middleware';
import {
  MIN_TIP_AMOUNT,
  MAX_TIP_AMOUNT,
  AGORA_FEED_PAGE_SIZE,
  AGORA_REPLIES_PAGE_SIZE,
  MAX_POST_IMAGES,
} from '../../utils/constants';
import { sanitizeContent } from '../utils';

/** Validate images array: must be data URLs, max MAX_POST_IMAGES. Returns sanitized array or null if invalid. */
function parseImages(raw: unknown): string[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const arr = raw.slice(0, MAX_POST_IMAGES).filter((s): s is string => typeof s === 'string' && s.startsWith('data:'));
  return arr.length <= MAX_POST_IMAGES ? arr : null;
}
import { createAgoraNotification } from '../notificationService';

/** POST /api/agora/posts - Create a post or reply (parentPost = reply). */
export const createPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { content, parentPost: parentPostId, images: rawImages } = req.body;

    if (typeof content !== 'string') {
      res.status(400).json({ success: false, message: 'Content must be a string' });
      return;
    }

    const images = parseImages(rawImages);
    if (images === null) {
      res.status(400).json({ success: false, message: `Up to ${MAX_POST_IMAGES} images (data URLs) allowed` });
      return;
    }

    const sanitized = sanitizeContent(content.trim());
    const hasContent = !!sanitized;
    const hasImages = images.length > 0;
    if (!hasContent && !hasImages) {
      res.status(400).json({ success: false, message: 'Content or at least one image is required' });
      return;
    }

    let parentPost: Types.ObjectId | undefined;
    if (parentPostId) {
      if (!Types.ObjectId.isValid(parentPostId)) {
        res.status(400).json({ success: false, message: 'Invalid parentPost id' });
        return;
      }
      const parent = await Post.findById(parentPostId);
      if (!parent) {
        res.status(404).json({ success: false, message: 'Parent post not found' });
        return;
      }
      parentPost = parent._id;
    }

    const post = new Post({
      user: new Types.ObjectId(userId),
      content: sanitized || '',
      images: images.length ? images : undefined,
      parentPost,
      likesCount: 0,
    });
    await post.save();

    const populated = await Post.findById(post._id)
      .populate('user', 'username email profilePicture')
      .populate('parentPost', 'content user createdAt')
      .lean();

    res.status(201).json({
      success: true,
      data: { post: populated ?? post },
      message: parentPost ? 'Reply posted' : 'Post created',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to create post',
    });
  }
};

/** GET /api/agora/posts - List posts (feed or replies). Paginated. */
export const listPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_FEED_PAGE_SIZE)
    );
    const authorId = req.query.author as string | undefined;
    const parentPostId = req.query.parentPost as string | undefined;
    const followingOnly = req.query.following === 'true' || req.query.following === '1';

    const filter: Record<string, unknown> = {};
    if (authorId && Types.ObjectId.isValid(authorId)) {
      filter.user = new Types.ObjectId(authorId);
    }
    if (followingOnly && userId) {
      const followingIds = await Follow.find({ follower: new Types.ObjectId(userId) })
        .select('following')
        .lean();
      const ids = followingIds.map((f) => f.following);
      if (ids.length === 0) {
        filter.user = { $in: [] };
      } else {
        filter.user = { $in: ids };
      }
    }
    if (parentPostId !== undefined) {
      if (parentPostId === '' || parentPostId === 'null') {
        filter.parentPost = { $in: [null, undefined] };
      } else if (Types.ObjectId.isValid(parentPostId)) {
        filter.parentPost = new Types.ObjectId(parentPostId);
      }
    } else {
      filter.parentPost = { $in: [null, undefined] };
    }
    filter.hidden = { $ne: true };

    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('user', 'username email profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    let postIds = posts.map((p) => p._id);
    let likedSet = new Set<string>();
    let bookmarkedSet = new Set<string>();
    if (userId && postIds.length > 0) {
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
      message: err instanceof Error ? err.message : 'Failed to list posts',
    });
  }
};

/** GET /api/agora/posts/:id - Get single post with paginated replies. */
export const getPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const replyPage = Math.max(1, parseInt(String(req.query.replyPage), 10) || 1);
    const replyLimit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.replyLimit), 10) || AGORA_REPLIES_PAGE_SIZE)
    );

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    const post = await Post.findById(id)
      .populate('user', 'username email profilePicture')
      .populate('parentPost', 'content user createdAt')
      .lean();

    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }
    if ((post as { hidden?: boolean }).hidden && !req.user?.isAdmin) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    const skip = (replyPage - 1) * replyLimit;
    const replyFilter: { parentPost: Types.ObjectId; hidden?: { $ne: boolean } } = {
      parentPost: new Types.ObjectId(id),
    };
    if (!req.user?.isAdmin) replyFilter.hidden = { $ne: true };
    const [replies, repliesTotal] = await Promise.all([
      Post.find(replyFilter)
        .populate('user', 'username email profilePicture')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(replyLimit)
        .lean(),
      Post.countDocuments(replyFilter),
    ]);

    let likedByCurrentUser = false;
    let bookmarkedByCurrentUser = false;
    let repliesLikedSet = new Set<string>();
    if (userId) {
      const ids = [post._id, ...replies.map((r) => r._id)];
      const [likes, bookmark] = await Promise.all([
        PostLike.find({ user: new Types.ObjectId(userId), post: { $in: ids } })
          .select('post')
          .lean(),
        PostBookmark.findOne({ user: new Types.ObjectId(userId), post: post._id }).lean(),
      ]);
      const likedIds = new Set(likes.map((l) => String(l.post)));
      likedByCurrentUser = likedIds.has(String(post._id));
      bookmarkedByCurrentUser = !!bookmark;
      replies.forEach((r) => {
        if (likedIds.has(String(r._id))) repliesLikedSet.add(String(r._id));
      });
    }

    const repliesWithLiked = replies.map((r) => ({
      ...r,
      likedByCurrentUser: repliesLikedSet.has(String(r._id)),
    }));

    res.json({
      success: true,
      data: {
        post: { ...post, likedByCurrentUser, bookmarkedByCurrentUser },
        replies: repliesWithLiked,
        repliesPagination: {
          page: replyPage,
          limit: replyLimit,
          total: repliesTotal,
          totalPages: Math.ceil(repliesTotal / replyLimit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get post',
    });
  }
};

/** PATCH /api/agora/posts/:id - Update own post. */
export const updatePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { content, images: rawImages } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    if (post.user.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to update this post' });
      return;
    }

    if (typeof content === 'string') {
      const sanitized = sanitizeContent(content);
      if (!sanitized) {
        res.status(400).json({ success: false, message: 'Content cannot be empty' });
        return;
      }
      post.content = sanitized;
    }

    if (rawImages !== undefined) {
      const images = parseImages(rawImages);
      if (images === null) {
        res.status(400).json({ success: false, message: `Up to ${MAX_POST_IMAGES} images (data URLs) allowed` });
        return;
      }
      post.images = images.length ? images : undefined;
    }

    await post.save();
    const populated = await Post.findById(post._id)
      .populate('user', 'username email profilePicture')
      .populate('parentPost', 'content user createdAt')
      .lean();

    res.json({ success: true, data: { post: populated ?? post } });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to update post',
    });
  }
};

/** DELETE /api/agora/posts/:id - Delete own post (and its likes/bookmarks/replies). */
export const deletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    if (post.user.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
      return;
    }

    await PostLike.deleteMany({ post: post._id });
    await PostBookmark.deleteMany({ post: post._id });
    await Post.deleteMany({ parentPost: post._id });
    await Post.findByIdAndDelete(id);

    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to delete post',
    });
  }
};

/** POST /api/agora/posts/:id/like - Like a post (idempotent). */
export const likePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    const existing = await PostLike.findOne({
      user: new Types.ObjectId(userId),
      post: post._id,
    });

    if (existing) {
      res.json({
        success: true,
        data: { liked: true, likesCount: post.likesCount },
        message: 'Already liked',
      });
      return;
    }

    await PostLike.create({ user: new Types.ObjectId(userId), post: post._id });
    post.likesCount += 1;
    await post.save();

    await createAgoraNotification(
      post.user.toString(),
      'like',
      userId,
      'Post',
      post._id
    );

    res.json({
      success: true,
      data: { liked: true, likesCount: post.likesCount },
      message: 'Post liked',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to like post',
    });
  }
};

/** DELETE /api/agora/posts/:id/like - Unlike a post. */
export const unlikePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    const deleted = await PostLike.findOneAndDelete({
      user: new Types.ObjectId(userId),
      post: post._id,
    });

    if (deleted) {
      post.likesCount = Math.max(0, post.likesCount - 1);
      await post.save();
    }

    res.json({
      success: true,
      data: { liked: false, likesCount: post.likesCount },
      message: 'Post unliked',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to unlike post',
    });
  }
};

/** POST /api/agora/posts/:id/tip - Tip loyalty points to the post author. */
export const tipPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const amount = req.body.amount != null ? Number(req.body.amount) : NaN;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    if (!Number.isInteger(amount) || amount < MIN_TIP_AMOUNT || amount > MAX_TIP_AMOUNT) {
      res.status(400).json({
        success: false,
        message: `Amount must be an integer between ${MIN_TIP_AMOUNT} and ${MAX_TIP_AMOUNT}`,
      });
      return;
    }

    const post = await Post.findById(id).populate('user');
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    const authorId = (post.user as { _id?: Types.ObjectId })._id?.toString() ?? post.user.toString();
    if (authorId === userId) {
      res.status(400).json({ success: false, message: 'Cannot tip your own post' });
      return;
    }

    const [tipper, author] = await Promise.all([
      User.findById(userId),
      User.findById(authorId),
    ]);

    if (!tipper || !author) {
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
    const authorNewBalance = author.loyaltyPoints + amount;

    await User.findByIdAndUpdate(userId, { loyaltyPoints: tipperNewBalance });
    await User.findByIdAndUpdate(authorId, { loyaltyPoints: authorNewBalance });

    await LoyaltyTransaction.create([
      {
        user: new Types.ObjectId(userId),
        type: 'tip_sent',
        amount: -amount,
        balanceAfter: tipperNewBalance,
        referenceType: 'Post',
        referenceId: post._id,
        metadata: { recipientId: authorId, postId: id },
      },
      {
        user: new Types.ObjectId(authorId),
        type: 'tip_received',
        amount,
        balanceAfter: authorNewBalance,
        referenceType: 'Post',
        referenceId: post._id,
        metadata: { fromUserId: userId, postId: id },
      },
    ]);

    await createAgoraNotification(
      authorId,
      'tip',
      userId,
      'Post',
      post._id,
      { amount, postId: id }
    );

    res.json({
      success: true,
      data: {
        amount,
        postId: id,
        recipientId: authorId,
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
