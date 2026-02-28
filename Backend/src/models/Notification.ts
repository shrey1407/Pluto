import mongoose, { Document, Schema, Types } from 'mongoose';

export type NotificationType = 'reply' | 'follow' | 'tip' | 'like';

export interface INotification extends Document {
  user: Types.ObjectId;       // recipient
  type: NotificationType;
  fromUser?: Types.ObjectId;  // actor (who replied, followed, tipped, liked)
  referenceType: 'Post' | 'User';
  referenceId?: Types.ObjectId;
  metadata?: Record<string, unknown>; // e.g. { postId, amount, preview }
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['reply', 'follow', 'tip', 'like'],
      required: true,
    },
    fromUser: { type: Schema.Types.ObjectId, ref: 'User' },
    referenceType: { type: String, enum: ['Post', 'User'], required: true },
    referenceId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, read: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
