import { Response } from 'express';
import { Types } from 'mongoose';
import { Notification } from '../../models';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AGORA_NOTIFICATIONS_PAGE_SIZE } from '../../utils/constants';

/** GET /api/agora/notifications - List current user's notifications. Paginated. */
export const listNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_NOTIFICATIONS_PAGE_SIZE)
    );
    const unreadOnly = req.query.unread === 'true' || req.query.unread === '1';
    const skip = (page - 1) * limit;

    const filter: { user: Types.ObjectId; read?: boolean } = {
      user: new Types.ObjectId(userId),
    };
    if (unreadOnly) filter.read = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('fromUser', 'username email profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        notifications: notifications.map((n) => ({
          id: n._id,
          type: n.type,
          fromUser: n.fromUser,
          referenceType: n.referenceType,
          referenceId: n.referenceId,
          metadata: n.metadata,
          read: n.read,
          createdAt: n.createdAt,
        })),
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
      message: err instanceof Error ? err.message : 'Failed to list notifications',
    });
  }
};

/** PATCH /api/agora/notifications/:id/read - Mark one notification as read. */
export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid notification id' });
      return;
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: new Types.ObjectId(userId) },
      { read: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    res.json({
      success: true,
      data: { notification: { id: notification._id, read: true } },
      message: 'Notification marked as read',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to mark as read',
    });
  }
};

/** POST /api/agora/notifications/read-all - Mark all current user's notifications as read. */
export const markAllNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const result = await Notification.updateMany(
      { user: new Types.ObjectId(userId), read: false },
      { read: true }
    );

    res.json({
      success: true,
      data: { updatedCount: result.modifiedCount },
      message: 'All notifications marked as read',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to mark all as read',
    });
  }
};
