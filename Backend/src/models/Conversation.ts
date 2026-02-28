import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IConversation extends Document {
  participants: [Types.ObjectId, Types.ObjectId];
  updatedAt: Date;
  createdAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      validate: {
        validator: (v: Types.ObjectId[]) => v.length === 2,
        message: 'Conversation must have exactly 2 participants',
      },
    },
  },
  { timestamps: true }
);

// Unique on the pair (participants.0, participants.1), not per-element, so one user can have many conversations
ConversationSchema.index({ 'participants.0': 1, 'participants.1': 1 }, { unique: true });
ConversationSchema.index({ updatedAt: -1 });

export const Conversation = mongoose.model<IConversation>(
  'Conversation',
  ConversationSchema
);
