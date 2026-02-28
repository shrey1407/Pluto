import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IUser extends Document {
  email?: string;
  emailVerified: boolean;
  passwordHash?: string;
  googleId?: string;
  username?: string;
  referralCode: string;
  referredBy?: Types.ObjectId;
  loyaltyPoints: number;
  dailyClaimStreak: number;
  lastDailyClaimAt?: Date;
  completedQuests: Types.ObjectId[];
  twitterId?: string;
  walletAddress?: string;
  profilePicture?: string; // URL or base64 data URL
  isAdmin?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, sparse: true, trim: true, lowercase: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    passwordHash: { type: String },
    googleId: { type: String, sparse: true },
    username: { type: String, trim: true },
    referralCode: { type: String, required: true, unique: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    loyaltyPoints: { type: Number, default: 0 },
    dailyClaimStreak: { type: Number, default: 0, min: 0, max: 7 },
    lastDailyClaimAt: { type: Date },
    completedQuests: [{ type: Schema.Types.ObjectId, ref: 'Quest' }],
    twitterId: { type: String },
    walletAddress: { type: String, trim: true },
    profilePicture: { type: String },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ googleId: 1 }, { unique: true, sparse: true });
UserSchema.index({ referralCode: 1 }, { unique: true });

export const User = mongoose.model<IUser>('User', UserSchema);
