import { Response } from 'express';
import { Types } from 'mongoose';
import { Post, PostBookmark, PostLike } from '../../models';
import { AuthRequest } from '../../middleware/auth.middleware';

/** POST /api/agora/posts/:id/bookmark - Bookmark a post. */
export const bookmarkPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id: postId } = req.params;

    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    const existing = await PostBookmark.findOne({
      user: new Types.ObjectId(userId),
      post: post._id,
    });
    if (existing) {
      res.json({ success: true, data: { bookmarked: true }, message: 'Already bookmarked' });
      return;
    }

    await PostBookmark.create({ user: new Types.ObjectId(userId), post: post._id });

    res.json({ success: true, data: { bookmarked: true }, message: 'Post bookmarked' });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to bookmark',
    });
  }
};

/** DELETE /api/agora/posts/:id/bookmark - Remove bookmark. */
export const removeBookmark = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id: postId } = req.params;

    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    await PostBookmark.findOneAndDelete({
      user: new Types.ObjectId(userId),
      post: new Types.ObjectId(postId),
    });

    res.json({ success: true, data: { bookmarked: false }, message: 'Bookmark removed' });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to remove bookmark',
    });
  }
};

/** GET /api/agora/me/bookmarks - List bookmarked posts. */
export const listBookmarks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 20));
    const skip = (page - 1) * limit;

    const [bookmarks, total] = await Promise.all([
      PostBookmark.find({ user: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('post')
        .lean(),
      PostBookmark.countDocuments({ user: new Types.ObjectId(userId) }),
    ]);

    const posts = bookmarks
      .map((b) => (b as { post?: unknown }).post)
      .filter(Boolean);
    const postIds = posts.map((p) => (p as { _id?: unknown })._id);
    const fullPosts = await Post.find({ _id: { $in: postIds } })
      .populate('user', 'username email profilePicture')
      .lean();

    const ordered = postIds
      .map((id) =>
        fullPosts.find((p) => p._id.toString() === (id as Types.ObjectId).toString())
      )
      .filter(Boolean);

    let likedSet = new Set<string>();
    if (postIds.length > 0) {
      const likes = await PostLike.find({
        user: new Types.ObjectId(userId),
        post: { $in: postIds },
      })
        .select('post')
        .lean();
      likedSet = new Set(likes.map((l) => String(l.post)));
    }

    const postsWithFlags = ordered.map((p) => ({
      ...p,
      likedByCurrentUser: likedSet.has(String((p as { _id?: Types.ObjectId })._id)),
      bookmarkedByCurrentUser: true,
    }));

    res.json({
      success: true,
      data: {
        posts: postsWithFlags,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list bookmarks',
    });
  }
};
