import { Router } from 'express';
import {
  createLinkCode,
  webhook,
  setWebhook,
  getMe,
  generateSummary,
  ask,
  getStats,
  getTelegramDigest,
} from '../controllers/pulsebot.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/set-webhook', setWebhook);
router.post('/webhook', webhook);
router.post('/link-code', requireAuth, createLinkCode);
router.get('/me', requireAuth, getMe);
router.get('/digest', requireAuth, getTelegramDigest);
router.post('/summary', requireAuth, generateSummary);
router.post('/ask', requireAuth, ask);
router.get('/stats', requireAuth, getStats);

export default router;
