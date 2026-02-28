import { Response } from 'express';
import { Types } from 'mongoose';
import { Post, PostLike, PostBookmark } from '../../models';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AGORA_REPLIES_PAGE_SIZE, MAX_POST_IMAGES } from '../../utils/constants';
import { sanitizeContent } from '../utils';
import { createAgoraNotification } from '../notificationService';
import { tipPost } from './posts.controller';

/** Validate images array: must be data URLs, max MAX_POST_IMAGES. Returns sanitized array or null if invalid. */
function parseImages(raw: unknown): string[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const arr = raw.slice(0, MAX_POST_IMAGES).filter((s): s is string => typeof s === 'string' && s.startsWith('data:'));
  return arr.length <= MAX_POST_IMAGES ? arr : null;
}

/** POST /api/agora/posts/:id/replies - Create a reply to a post. */
export const createReply = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id: parentPostId } = req.params;
    const { content, images: rawImages } = req.body;

    if (!Types.ObjectId.isValid(parentPostId)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }
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

    const parent = await Post.findById(parentPostId);
    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent post not found' });
      return;
    }

    const post = new Post({
      user: new Types.ObjectId(userId),
      content: sanitized || '',
      images: images.length ? images : undefined,
      parentPost: parent._id,
      likesCount: 0,
    });
    await post.save();

    await createAgoraNotification(
      parent.user.toString(),
      'reply',
      userId,
      'Post',
      parent._id,
      { replyPostId: post._id, postId: parentPostId, preview: sanitized.slice(0, 80) }
    );

    const populated = await Post.findById(post._id)
      .populate('user', 'username email profilePicture')
      .populate('parentPost', 'content user createdAt')
      .lean();

    res.status(201).json({
      success: true,
      data: { post: populated ?? post },
      message: 'Reply posted',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to create reply',
    });
  }
};

/** GET /api/agora/posts/:id/replies - List replies to a post. Paginated. */
export const listReplies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id: parentPostId } = req.params;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_REPLIES_PAGE_SIZE)
    );
    const skip = (page - 1) * limit;

    if (!Types.ObjectId.isValid(parentPostId)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    const filter = {
      parentPost: new Types.ObjectId(parentPostId),
      hidden: { $ne: true },
    };
    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('user', 'username email profilePicture')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    let likedSet = new Set<string>();
    if (userId && posts.length > 0) {
      const likes = await PostLike.find({
        user: new Types.ObjectId(userId),
        post: { $in: posts.map((p) => p._id) },
      })
        .select('post')
        .lean();
      likedSet = new Set(likes.map((l) => String(l.post)));
    }

    const items = posts.map((p) => ({
      ...p,
      likedByCurrentUser: likedSet.has(String(p._id)),
    }));

    res.json({
      success: true,
      data: {
        replies: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list replies',
    });
  }
};

/** DELETE /api/agora/replies/:id - Delete a reply (owner only). */
export const deleteReply = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid reply id' });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }
    if (!post.parentPost) {
      res.status(400).json({ success: false, message: 'Not a reply' });
      return;
    }
    if (post.user.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to delete this reply' });
      return;
    }

    await PostLike.deleteMany({ post: post._id });
    await PostBookmark.deleteMany({ post: post._id });
    await Post.findByIdAndDelete(id);

    res.json({ success: true, message: 'Reply deleted' });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to delete reply',
    });
  }
};

/** POST /api/agora/replies/:id/tip - Tip the reply author (same as post tip). */
export const tipReply = async (req: AuthRequest, res: Response): Promise<void> => {
  return tipPost(req, res);
};
