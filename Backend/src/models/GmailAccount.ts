import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IGmailAccount extends Document {
  user: Types.ObjectId;
  /** Gmail address (e.g. user@gmail.com) */
  email: string;
  /** OAuth2 refresh token – used to get access tokens */
  refreshToken: string;
  /** Last time we synced emails for this account */
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GmailAccountSchema = new Schema<IGmailAccount>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    refreshToken: { type: String, required: true },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

GmailAccountSchema.index({ user: 1 }, { unique: true });

export const GmailAccount = mongoose.model<IGmailAccount>('GmailAccount', GmailAccountSchema);
