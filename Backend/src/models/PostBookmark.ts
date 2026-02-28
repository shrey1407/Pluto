import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPostBookmark extends Document {
  user: Types.ObjectId;
  post: Types.ObjectId;
  createdAt: Date;
}

const PostBookmarkSchema = new Schema<IPostBookmark>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  },
  { timestamps: true }
);

PostBookmarkSchema.index({ user: 1, post: 1 }, { unique: true });
PostBookmarkSchema.index({ user: 1, createdAt: -1 });

export const PostBookmark = mongoose.model<IPostBookmark>(
  'PostBookmark',
  PostBookmarkSchema
);
