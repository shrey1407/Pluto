import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPost extends Document {
  user: Types.ObjectId;
  content: string;
  images?: string[]; // base64 data URLs (same as profile picture)
  parentPost?: Types.ObjectId; // for thread replies
  likesCount: number;
  hidden?: boolean; // set by admin; hidden posts excluded from feeds
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    images: [{ type: String }], // base64 data URLs
    parentPost: { type: Schema.Types.ObjectId, ref: 'Post' },
    likesCount: { type: Number, default: 0, min: 0 },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PostSchema.index({ user: 1, createdAt: -1 });
PostSchema.index({ parentPost: 1, createdAt: 1 });

export const Post = mongoose.model<IPost>('Post', PostSchema);
