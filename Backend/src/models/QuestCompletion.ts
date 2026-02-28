import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IQuestCompletion extends Document {
  user: Types.ObjectId;
  quest: Types.ObjectId;
  campaign: Types.ObjectId;
  pointsAwarded: number;
  completedAt: Date;
}

const QuestCompletionSchema = new Schema<IQuestCompletion>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    quest: { type: Schema.Types.ObjectId, ref: 'Quest', required: true },
    campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    pointsAwarded: { type: Number, required: true, min: 0 },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

QuestCompletionSchema.index({ user: 1, quest: 1 }, { unique: true });
QuestCompletionSchema.index({ campaign: 1 });

export const QuestCompletion = mongoose.model<IQuestCompletion>(
  'QuestCompletion',
  QuestCompletionSchema
);
