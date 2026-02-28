import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPulseBotLink extends Document {
  user: Types.ObjectId;
  telegramUserId: number;
  telegramUsername?: string;
  telegramChatId: number; // private chat id with bot (for DMs)
  linkedAt: Date;
}

const PulseBotLinkSchema = new Schema<IPulseBotLink>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    telegramUserId: { type: Number, required: true, unique: true },
    telegramUsername: { type: String },
    telegramChatId: { type: Number, required: true },
  },
  { timestamps: true }
);

PulseBotLinkSchema.index({ user: 1 }, { unique: true });
PulseBotLinkSchema.index({ telegramUserId: 1 }, { unique: true });

export const PulseBotLink = mongoose.model<IPulseBotLink>('PulseBotLink', PulseBotLinkSchema);
