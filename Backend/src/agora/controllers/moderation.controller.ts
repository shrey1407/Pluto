import { Response } from 'express';
import { Types } from 'mongoose';
import { Report, Post, User } from '../../models';
import { AuthRequest } from '../../middleware/auth.middleware';

/** POST /api/agora/posts/:id/report - Report a post. */
export const reportPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id: postId } = req.params;
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : undefined;

    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    const existing = await Report.findOne({
      reporter: new Types.ObjectId(userId),
      referenceType: 'Post',
      referenceId: post._id,
    });
    if (existing) {
      res.json({
        success: true,
        data: { reportId: existing._id },
        message: 'You have already reported this post',
      });
      return;
    }

    const report = await Report.create({
      reporter: new Types.ObjectId(userId),
      referenceType: 'Post',
      referenceId: post._id,
      reason: reason || undefined,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      data: { reportId: report._id },
      message: 'Post reported',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to report post',
    });
  }
};

/** POST /api/agora/users/:id/report - Report a user. */
export const reportUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id: targetId } = req.params;
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : undefined;

    if (!Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ success: false, message: 'Invalid user id' });
      return;
    }

    if (targetId === userId) {
      res.status(400).json({ success: false, message: 'Cannot report yourself' });
      return;
    }

    const target = await User.findById(targetId);
    if (!target) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const existing = await Report.findOne({
      reporter: new Types.ObjectId(userId),
      referenceType: 'User',
      referenceId: new Types.ObjectId(targetId),
    });
    if (existing) {
      res.json({
        success: true,
        data: { reportId: existing._id },
        message: 'You have already reported this user',
      });
      return;
    }

    const report = await Report.create({
      reporter: new Types.ObjectId(userId),
      referenceType: 'User',
      referenceId: new Types.ObjectId(targetId),
      reason: reason || undefined,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      data: { reportId: report._id },
      message: 'User reported',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to report user',
    });
  }
};

/** GET /api/agora/admin/reports - List reports (admin). Paginated, filter by status. */
export const listReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 20));
    const status = req.query.status as string | undefined;
    const skip = (page - 1) * limit;

    const filter: { status?: string } = {};
    if (status && ['pending', 'reviewed', 'dismissed'].includes(status)) {
      filter.status = status;
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate('reporter', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(filter),
    ]);

    const withRef = await Promise.all(
      reports.map(async (r) => {
        let reference = null;
        if (r.referenceType === 'Post') {
          const post = await Post.findById(r.referenceId)
            .select('content user createdAt hidden')
            .populate('user', 'username email profilePicture')
            .lean();
          reference = post;
        } else if (r.referenceType === 'User') {
          const user = await User.findById(r.referenceId)
            .select('username email referralCode')
            .lean();
          reference = user;
        }
        return {
          id: r._id,
          reporter: r.reporter,
          referenceType: r.referenceType,
          referenceId: r.referenceId,
          reference,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt,
        };
      })
    );

    res.json({
      success: true,
      data: {
        reports: withRef,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list reports',
    });
  }
};

/** PATCH /api/agora/admin/reports/:id - Update report status (admin). Body: { status: 'reviewed' | 'dismissed' }. */
export const updateReportStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: reportId } = req.params;
    const status = req.body.status as string | undefined;

    if (!Types.ObjectId.isValid(reportId)) {
      res.status(400).json({ success: false, message: 'Invalid report id' });
      return;
    }
    if (!status || !['reviewed', 'dismissed'].includes(status)) {
      res.status(400).json({ success: false, message: 'status must be "reviewed" or "dismissed"' });
      return;
    }

    const report = await Report.findByIdAndUpdate(
      reportId,
      { status },
      { new: true }
    );

    if (!report) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }

    res.json({
      success: true,
      data: { report: { id: report._id, status: report.status } },
      message: `Report ${status}`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to update report',
    });
  }
};

/** PATCH /api/agora/admin/posts/:id/hide - Hide a post (admin). */
export const hidePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid post id' });
      return;
    }

    const post = await Post.findByIdAndUpdate(
      id,
      { hidden: true },
      { new: true }
    );

    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    res.json({
      success: true,
      data: { post: { id: post._id, hidden: true } },
      message: 'Post hidden',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to hide post',
    });
  }
};
