import { Types } from 'mongoose';
import { Notification } from '../models';
import type { NotificationType } from '../models';

/**
 * Create an Agora notification. Skips if recipient === actor (no self-notify).
 */
export async function createAgoraNotification(
  recipientUserId: string,
  type: NotificationType,
  fromUserId: string,
  referenceType: 'Post' | 'User',
  referenceId: Types.ObjectId,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (recipientUserId === fromUserId) return;
  await Notification.create({
    user: new Types.ObjectId(recipientUserId),
    type,
    fromUser: new Types.ObjectId(fromUserId),
    referenceType,
    referenceId,
    metadata,
    read: false,
  });
}
