import mongoose, { Document, Schema, Types } from 'mongoose';

export type ReportReferenceType = 'Post' | 'User';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export interface IReport extends Document {
  reporter: Types.ObjectId;
  referenceType: ReportReferenceType;
  referenceId: Types.ObjectId;
  reason?: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referenceType: { type: String, enum: ['Post', 'User'], required: true },
    referenceId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'dismissed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

ReportSchema.index({ referenceType: 1, referenceId: 1 });
ReportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
