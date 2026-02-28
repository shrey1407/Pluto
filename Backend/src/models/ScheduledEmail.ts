import mongoose, { Document, Schema, Types } from 'mongoose';

export type ScheduledEmailStatus = 'pending' | 'sent' | 'failed';

export interface IScheduledEmail extends Document {
  user: Types.ObjectId;
  gmailAccount: Types.ObjectId;
  to: string;
  subject: string;
  bodyPlain: string;
  /** When to send (cron processes when scheduledFor <= now) */
  scheduledFor: Date;
  status: ScheduledEmailStatus;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledEmailSchema = new Schema<IScheduledEmail>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gmailAccount: { type: Schema.Types.ObjectId, ref: 'GmailAccount', required: true },
    to: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    bodyPlain: { type: String, required: true, default: '' },
    scheduledFor: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    sentAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true }
);

ScheduledEmailSchema.index({ user: 1, status: 1, scheduledFor: 1 });
ScheduledEmailSchema.index({ status: 1, scheduledFor: 1 }); // for cron

export const ScheduledEmail = mongoose.model<IScheduledEmail>('ScheduledEmail', ScheduledEmailSchema);
