import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPostLike extends Document {
  user: Types.ObjectId;
  post: Types.ObjectId;
  createdAt: Date;
}

const PostLikeSchema = new Schema<IPostLike>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  },
  { timestamps: true }
);

PostLikeSchema.index({ user: 1, post: 1 }, { unique: true });
PostLikeSchema.index({ post: 1 });

export const PostLike = mongoose.model<IPostLike>('PostLike', PostLikeSchema);
