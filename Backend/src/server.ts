import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import routes from './routes';
import { setupSocketIO } from './socket';
import { generalApiLimiter } from './middleware/rateLimit.middleware';
import { Conversation } from './models';
import { startScheduledEmailCron } from './jobs/scheduledEmail.job';

// Load .env from Backend directory so GEMINI_API_KEY etc. are found regardless of cwd
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config(); // still allow cwd .env to override

const app = express();
const PORT = process.env.PORT ?? 5000;
const MONGO_URI = process.env.MONGO_URI ?? '';

// Trust first proxy (ngrok, Cloudflare Tunnel, etc.) so rate limiter uses X-Forwarded-For
app.set('trust proxy', 1);

// Middleware – increase limit for profile picture (base64) and other large JSON bodies
app.use(helmet());
const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin === '*' || !corsOrigin ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for all API routes
app.use('/api', generalApiLimiter);

// API routes
app.use('/api', routes);

// Hello World root route
app.get('/', (_req, res) => {
  res.json({ message: 'Hello World' });
});

// Global error handler (for errors passed to next() or unhandled in route handlers)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  const status = (err as Error & { status?: number }).status ?? 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// MongoDB connection and server start
const startServer = async (): Promise<void> => {
  try {
    if (MONGO_URI) {
      await mongoose.connect(MONGO_URI);
      console.log('MongoDB connected');
      // Drop old multikey unique index that allowed only one conversation per user; new index is on (participants.0, participants.1)
      await Conversation.collection.dropIndex('participants_1').catch(() => {});
      startScheduledEmailCron();
    } else {
      console.warn('MONGO_URI not set – running without database');
    }

    const server = http.createServer(app);
    setupSocketIO(server);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.IO enabled for real-time messaging`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
