import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISyncedEmail extends Document {
  user: Types.ObjectId;
  gmailAccount: Types.ObjectId;
  /** Gmail API message id (string) */
  messageId: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  /** Plain text snippet (first ~200 chars) */
  snippet: string;
  /** Full body (plain or HTML); optional, can be fetched on demand */
  bodyPlain?: string;
  bodyHtml?: string;
  date: Date;
  labelIds: string[];
  /** Whether we've already suggested a reply / user dismissed */
  taskResolved?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SyncedEmailSchema = new Schema<ISyncedEmail>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gmailAccount: { type: Schema.Types.ObjectId, ref: 'GmailAccount', required: true },
    messageId: { type: String, required: true },
    threadId: { type: String, required: true },
    from: { type: String, required: true, default: '' },
    to: { type: String, default: '' },
    subject: { type: String, required: true, default: '' },
    snippet: { type: String, default: '' },
    bodyPlain: { type: String },
    bodyHtml: { type: String },
    date: { type: Date, required: true },
    labelIds: { type: [String], default: [] },
    taskResolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SyncedEmailSchema.index({ user: 1, gmailAccount: 1, messageId: 1 }, { unique: true });
SyncedEmailSchema.index({ user: 1, date: -1 });
SyncedEmailSchema.index({ gmailAccount: 1, date: -1 });

export const SyncedEmail = mongoose.model<ISyncedEmail>('SyncedEmail', SyncedEmailSchema);
