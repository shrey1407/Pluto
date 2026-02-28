import mongoose, { Document, Schema, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'completed' | 'failed';

export interface IPayment extends Document {
  user: Types.ObjectId;
  pointsAmount: number;
  currency: string;
  amountCrypto: string;
  txHash: string;
  status: PaymentStatus;
  walletAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pointsAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, trim: true },
    amountCrypto: { type: String, required: true },
    txHash: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    walletAddress: { type: String, trim: true, lowercase: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ user: 1, createdAt: -1 });
PaymentSchema.index({ txHash: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
