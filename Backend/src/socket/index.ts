import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Types } from 'mongoose';
import { verifyToken } from '../utils/auth.utils';
import { Conversation, Message, User } from '../models';
import { MAX_MESSAGE_CONTENT_LENGTH } from '../utils/constants';

function sanitizeMessageContent(content: string): string {
  return content.trim().slice(0, MAX_MESSAGE_CONTENT_LENGTH);
}

function isParticipant(
  conversation: { participants: Types.ObjectId[] },
  userId: string
): boolean {
  return conversation.participants.some((p) => p.toString() === userId);
}

const CONVERSATION_ROOM_PREFIX = 'conversation:';

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function setupSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket: Socket, next: (err?: Error) => void) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.query?.token as string);
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyToken(token);
      if (!payload?.userId || !Types.ObjectId.isValid(payload.userId)) {
        return next(new Error('Invalid token'));
      }
      (socket as Socket & { data: { userId: string } }).data.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket & { data: { userId: string } }) => {
    const userId = socket.data.userId;

    socket.on('join_conversation', async (conversationId: string, ack?: (err: string | null) => void) => {
      if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
        ack?.('Invalid conversation id');
        return;
      }
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        ack?.('Conversation not found');
        return;
      }
      if (!isParticipant(conversation, userId)) {
        ack?.('Not part of this conversation');
        return;
      }
      const room = CONVERSATION_ROOM_PREFIX + conversationId;
      await socket.join(room);
      ack?.(null);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      const room = CONVERSATION_ROOM_PREFIX + conversationId;
      socket.leave(room);
    });

    socket.on(
      'send_message',
      async (
        payload: { conversationId: string; content: string },
        ack?: (err: string | null, data?: unknown) => void
      ) => {
        const { conversationId, content } = payload ?? {};
        if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
          ack?.('Invalid conversation id');
          return;
        }
        if (typeof content !== 'string' || !content.trim()) {
          ack?.('Content is required');
          return;
        }
        const sanitized = sanitizeMessageContent(content);
        if (!sanitized) {
          ack?.('Content cannot be empty');
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          ack?.('Conversation not found');
          return;
        }
        if (!isParticipant(conversation, userId)) {
          ack?.('Not part of this conversation');
          return;
        }

        const message = await Message.create({
          conversation: conversation._id,
          sender: new Types.ObjectId(userId),
          content: sanitized,
        });

        await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });

        const populated = await Message.findById(message._id)
          .populate('sender', 'username email')
          .lean();

        const room = CONVERSATION_ROOM_PREFIX + conversationId;
        const messagePayload = {
          id: populated?._id ?? message._id,
          conversationId,
          sender: populated?.sender ?? { _id: userId },
          content: sanitized,
          createdAt: populated?.createdAt ?? message.createdAt,
        };
        io.to(room).emit('new_message', messagePayload);
        ack?.(null, messagePayload);
      }
    );

    socket.on(
      'typing_start',
      async (conversationId: string) => {
        if (!conversationId || !Types.ObjectId.isValid(conversationId)) return;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isParticipant(conversation, userId)) return;
        const user = await User.findById(userId).select('username').lean();
        socket.to(CONVERSATION_ROOM_PREFIX + conversationId).emit('user_typing', {
          conversationId,
          userId,
          username: user?.username ?? userId,
        });
      }
    );

    socket.on('typing_stop', (conversationId: string) => {
      if (!conversationId) return;
      socket.to(CONVERSATION_ROOM_PREFIX + conversationId).emit('user_stopped_typing', {
        conversationId,
        userId,
      });
    });

    socket.on('disconnect', () => {
      // rooms are left automatically
    });
  });

  ioInstance = io;
  return io;
}
