import mongoose, { Document, Schema, Types } from 'mongoose';

export type LoyaltyTransactionType =
  | 'quest_complete'
  | 'referral'
  | 'campaign_launch'
  | 'campaign_quest_add'
  | 'feature_use'
  | 'purchase'
  | 'daily_claim'
  | 'tip_sent'
  | 'tip_received'
  | 'admin_adjust';

export interface ILoyaltyTransaction extends Document {
  user: Types.ObjectId;
  type: LoyaltyTransactionType;
  amount: number; // positive = credit, negative = debit
  balanceAfter?: number;
  referenceType?: 'Quest' | 'Campaign' | 'Post' | 'Payment' | 'DailyClaim' | 'Feature' | 'User';
  referenceId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'quest_complete',
        'referral',
        'campaign_launch',
        'campaign_quest_add',
        'feature_use',
        'purchase',
        'daily_claim',
        'tip_sent',
        'tip_received',
        'admin_adjust',
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number },
    referenceType: { type: String, enum: ['Quest', 'Campaign', 'Post', 'Payment', 'DailyClaim', 'Feature', 'User'] },
    referenceId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

LoyaltyTransactionSchema.index({ user: 1, createdAt: -1 });
LoyaltyTransactionSchema.index({ type: 1, referenceId: 1 });

export const LoyaltyTransaction = mongoose.model<ILoyaltyTransaction>(
  'LoyaltyTransaction',
  LoyaltyTransactionSchema
);
