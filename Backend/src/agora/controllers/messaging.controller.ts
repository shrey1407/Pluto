import { Response } from 'express';
import { Types } from 'mongoose';
import { Conversation, Message, User } from '../../models';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AGORA_MESSAGES_PAGE_SIZE, MAX_MESSAGE_CONTENT_LENGTH } from '../../utils/constants';
import { getIO } from '../../socket';

/** Sort participant IDs so [A,B] and [B,A] match the same conversation. */
function sortedParticipantIds(a: string, b: string): Types.ObjectId[] {
  const ids = [new Types.ObjectId(a), new Types.ObjectId(b)];
  ids.sort((x, y) => x.toString().localeCompare(y.toString()));
  return ids;
}

/** Ensure current user is a participant in the conversation. */
function isParticipant(conversation: { participants: Types.ObjectId[] }, userId: string): boolean {
  return conversation.participants.some((p) => p.toString() === userId);
}

/** GET /api/agora/conversations - List my conversations (with last message). */
export const listConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_MESSAGES_PAGE_SIZE)
    );
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find({
      participants: new Types.ObjectId(userId),
    })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const withLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await Message.findOne({ conversation: conv._id })
          .sort({ createdAt: -1 })
          .populate('sender', 'username email')
          .lean();
        const otherId = (conv.participants as Types.ObjectId[]).find(
          (p) => p.toString() !== userId
        );
        const other = otherId
          ? await User.findById(otherId).select('username email profilePicture').lean()
          : null;
        return {
          id: conv._id,
          participants: conv.participants,
          otherUser: other,
          lastMessage: lastMessage
            ? {
                id: lastMessage._id,
                content: lastMessage.content,
                sender: lastMessage.sender,
                createdAt: lastMessage.createdAt,
              }
            : null,
          updatedAt: conv.updatedAt,
          createdAt: conv.createdAt,
        };
      })
    );

    const total = await Conversation.countDocuments({
      participants: new Types.ObjectId(userId),
    });

    res.json({
      success: true,
      data: {
        conversations: withLastMessage,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list conversations',
    });
  }
};

/** POST /api/agora/conversations - Get or create conversation with another user. */
export const getOrCreateConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { otherUserId } = req.body;

    if (!otherUserId || typeof otherUserId !== 'string') {
      res.status(400).json({ success: false, message: 'otherUserId is required' });
      return;
    }

    if (!Types.ObjectId.isValid(otherUserId)) {
      res.status(400).json({ success: false, message: 'Invalid otherUserId' });
      return;
    }

    if (otherUserId === userId) {
      res.status(400).json({ success: false, message: 'Cannot create conversation with yourself' });
      return;
    }

    const other = await User.findById(otherUserId).select('username email profilePicture').lean();
    if (!other) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const participantIds = sortedParticipantIds(userId, otherUserId);
    let conversation = await Conversation.findOne({
      participants: participantIds,
    }).lean();

    if (!conversation) {
      const created = await Conversation.create({
        participants: participantIds,
      });
      conversation = await Conversation.findById(created._id).lean();
    }

    const lastMessage = await Message.findOne({ conversation: conversation!._id })
      .sort({ createdAt: -1 })
      .populate('sender', 'username email')
      .lean();

    res.json({
      success: true,
      data: {
        conversation: {
          id: conversation!._id,
          participants: conversation!.participants,
          otherUser: other,
          lastMessage: lastMessage
            ? {
                id: lastMessage._id,
                content: lastMessage.content,
                sender: lastMessage.sender,
                createdAt: lastMessage.createdAt,
              }
            : null,
          updatedAt: conversation!.updatedAt,
          createdAt: conversation!.createdAt,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get or create conversation',
    });
  }
};

/** GET /api/agora/conversations/:id/messages - Get messages in a conversation (paginated). */
export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id: conversationId } = req.params;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit), 10) || AGORA_MESSAGES_PAGE_SIZE)
    );
    const skip = (page - 1) * limit;

    if (!Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ success: false, message: 'Invalid conversation id' });
      return;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    if (!isParticipant(conversation, userId)) {
      res.status(403).json({ success: false, message: 'Not part of this conversation' });
      return;
    }

    const [messages, total] = await Promise.all([
      Message.find({ conversation: conversation._id })
        .populate('sender', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ conversation: conversation._id }),
    ]);

    const ordered = messages.reverse();

    res.json({
      success: true,
      data: {
        messages: ordered,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get messages',
    });
  }
};

/** PATCH /api/agora/conversations/:convId/messages/:msgId - Edit message (sender only). */
export const editMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { convId, msgId } = req.params;
    const { content } = req.body;

    if (!Types.ObjectId.isValid(convId) || !Types.ObjectId.isValid(msgId)) {
      res.status(400).json({ success: false, message: 'Invalid conversation or message id' });
      return;
    }
    if (typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ success: false, message: 'Content is required' });
      return;
    }
    const sanitized = content.trim().slice(0, MAX_MESSAGE_CONTENT_LENGTH);
    if (!sanitized) {
      res.status(400).json({ success: false, message: 'Content cannot be empty' });
      return;
    }

    const conversation = await Conversation.findById(convId);
    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }
    if (!isParticipant(conversation, userId)) {
      res.status(403).json({ success: false, message: 'Not part of this conversation' });
      return;
    }

    const message = await Message.findOne({ _id: msgId, conversation: convId });
    if (!message) {
      res.status(404).json({ success: false, message: 'Message not found' });
      return;
    }
    if (message.sender.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to edit this message' });
      return;
    }

    message.content = sanitized;
    message.editedAt = new Date();
    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'username email')
      .lean();

    const payload = {
      id: String(populated?._id ?? message._id),
      conversationId: String(convId),
      sender: populated?.sender ?? { _id: userId },
      content: populated?.content ?? message.content,
      editedAt: populated?.editedAt ?? message.editedAt,
      createdAt: populated?.createdAt ?? message.createdAt,
    };

    const io = getIO();
    if (io) {
      io.to('conversation:' + convId).emit('message_edited', payload);
    }

    res.json({
      success: true,
      data: {
        message: {
          _id: populated?._id ?? message._id,
          conversation: populated?.conversation ?? message.conversation,
          sender: populated?.sender ?? message.sender,
          content: populated?.content ?? message.content,
          editedAt: populated?.editedAt ?? message.editedAt,
          createdAt: populated?.createdAt ?? message.createdAt,
        },
      },
      message: 'Message updated',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to edit message',
    });
  }
};

/** DELETE /api/agora/conversations/:convId/messages/:msgId - Delete message (sender only). */
export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { convId, msgId } = req.params;

    if (!Types.ObjectId.isValid(convId) || !Types.ObjectId.isValid(msgId)) {
      res.status(400).json({ success: false, message: 'Invalid conversation or message id' });
      return;
    }

    const conversation = await Conversation.findById(convId);
    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }
    if (!isParticipant(conversation, userId)) {
      res.status(403).json({ success: false, message: 'Not part of this conversation' });
      return;
    }

    const message = await Message.findOne({ _id: msgId, conversation: convId });
    if (!message) {
      res.status(404).json({ success: false, message: 'Message not found' });
      return;
    }
    if (message.sender.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to delete this message' });
      return;
    }

    await Message.findByIdAndDelete(msgId);

    const io = getIO();
    if (io) {
      io.to('conversation:' + convId).emit('message_deleted', {
        conversationId: String(convId),
        messageId: String(msgId),
      });
    }

    res.json({
      success: true,
      message: 'Message deleted',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to delete message',
    });
  }
};
