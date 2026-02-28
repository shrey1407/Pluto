import mongoose, { Document, Schema } from 'mongoose';

export interface IPulseBotMessage extends Document {
  groupTelegramId: string; // Telegram chat.id for groups (negative number as string)
  groupTitle?: string;
  fromTelegramUserId: number;
  fromUsername?: string;
  text: string;
  messageDate: Date;
  telegramMessageId?: number;
  createdAt: Date;
}

const PulseBotMessageSchema = new Schema<IPulseBotMessage>(
  {
    groupTelegramId: { type: String, required: true },
    groupTitle: { type: String },
    fromTelegramUserId: { type: Number, required: true },
    fromUsername: { type: String },
    text: { type: String, required: true },
    messageDate: { type: Date, required: true },
    telegramMessageId: { type: Number },
  },
  { timestamps: true }
);

PulseBotMessageSchema.index({ groupTelegramId: 1, messageDate: -1 });
PulseBotMessageSchema.index({ fromTelegramUserId: 1, messageDate: -1 });

export const PulseBotMessage = mongoose.model<IPulseBotMessage>(
  'PulseBotMessage',
  PulseBotMessageSchema
);
