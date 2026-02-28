import mongoose, { Document, Schema, Types } from 'mongoose';

/** Points per day: day 1 = 10, day 2 = 20, ... day 7 = 70. Day 8+ resets or repeats as per product. */
export const DAILY_CLAIM_POINTS = [10, 20, 30, 40, 50, 60, 70] as const;

export interface IDailyClaim extends Document {
  user: Types.ObjectId;
  dayNumber: number; // 1-7
  pointsClaimed: number;
  claimedAt: Date;
}

const DailyClaimSchema = new Schema<IDailyClaim>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dayNumber: { type: Number, required: true, min: 1, max: 7 },
    pointsClaimed: { type: Number, required: true, min: 0 },
    claimedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DailyClaimSchema.index({ user: 1, claimedAt: -1 });

export const DailyClaim = mongoose.model<IDailyClaim>('DailyClaim', DailyClaimSchema);
