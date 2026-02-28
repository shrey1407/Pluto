import mongoose, { Document, Schema, Types } from 'mongoose';

export type EmailTaskType = 'reply_needed' | 'follow_up' | 'action' | 'info';

export interface IEmailTask extends Document {
  user: Types.ObjectId;
  syncedEmail: Types.ObjectId;
  /** Short title for the task (e.g. "Reply: HR reimbursement confirmation") */
  title: string;
  /** Longer description or suggested action */
  description: string;
  type: EmailTaskType;
  /** AI-generated suggested reply (plain text) – may be refined by user */
  suggestedReply?: string;
  /** User-confirmed final reply before send */
  confirmedReply?: string;
  /** Whether the reply was sent via Gmail API */
  replySentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmailTaskSchema = new Schema<IEmailTask>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    syncedEmail: { type: Schema.Types.ObjectId, ref: 'SyncedEmail', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['reply_needed', 'follow_up', 'action', 'info'],
      default: 'reply_needed',
    },
    suggestedReply: { type: String },
    confirmedReply: { type: String },
    replySentAt: { type: Date },
  },
  { timestamps: true }
);

EmailTaskSchema.index({ user: 1, createdAt: -1 });
EmailTaskSchema.index({ syncedEmail: 1 });

export const EmailTask = mongoose.model<IEmailTask>('EmailTask', EmailTaskSchema);
