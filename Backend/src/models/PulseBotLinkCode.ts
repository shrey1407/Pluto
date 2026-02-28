import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPulseBotLinkCode extends Document {
  user: Types.ObjectId;
  code: string;
  expiresAt: Date;
  createdAt: Date;
}

const PulseBotLinkCodeSchema = new Schema<IPulseBotLinkCode>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

PulseBotLinkCodeSchema.index({ code: 1 }, { unique: true });
PulseBotLinkCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL optional

export const PulseBotLinkCode = mongoose.model<IPulseBotLinkCode>(
  'PulseBotLinkCode',
  PulseBotLinkCodeSchema
);
