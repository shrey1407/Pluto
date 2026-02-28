import mongoose, { Document, Schema, Types } from 'mongoose';

export type QuestType =
  | 'follow_twitter'
  | 'retweet_tweet'
  | 'tweet_tag'
  | 'agora_follow'
  | 'agora_like_post'
  | 'agora_comment'
  | 'agora_bookmark_post';

export interface IQuest extends Document {
  title: string;
  description: string;
  requiredLink: string;
  campaignId: Types.ObjectId;
  type: QuestType;
  createdAt: Date;
  updatedAt: Date;
}

const QuestSchema = new Schema<IQuest>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    requiredLink: { type: String, required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    type: {
      type: String,
      enum: ['follow_twitter', 'retweet_tweet', 'tweet_tag', 'agora_follow', 'agora_like_post', 'agora_comment', 'agora_bookmark_post'],
      required: true,
    },
  },
  { timestamps: true }
);

QuestSchema.index({ campaignId: 1 });

export const Quest = mongoose.model<IQuest>('Quest', QuestSchema);
