import mongoose, { Document, Schema, Types } from 'mongoose';

export type CampaignStatus = 'active' | 'expired' | 'draft';

export interface ICampaign extends Document {
  name: string;
  description: string;
  owner: Types.ObjectId;
  quests: Types.ObjectId[];
  participants: Types.ObjectId[];
  costInPoints: number;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
  expiryDate?: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    quests: [{ type: Schema.Types.ObjectId, ref: 'Quest' }],
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    costInPoints: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['active', 'expired', 'draft'],
      default: 'active',
    },
    expiryDate: { type: Date },
  },
  { timestamps: true }
);

CampaignSchema.index({ owner: 1 });
CampaignSchema.index({ status: 1, expiryDate: 1 });

export const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);
