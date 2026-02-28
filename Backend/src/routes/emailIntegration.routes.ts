import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getGmailConnectUrl,
  gmailCallback,
  disconnectGmail,
  syncGmail,
  listTasks,
  getEmail,
  suggestReply,
  sendReply,
  getStatus,
  getGmailDigest,
  scheduleEmail,
  listScheduledEmails,
  getScheduledEmail,
  updateScheduledEmail,
  deleteScheduledEmail,
} from '../controllers/emailIntegration.controller';

const router = Router();

router.get('/status', requireAuth, getStatus);
router.get('/gmail/digest', requireAuth, getGmailDigest);
router.get('/gmail/auth-url', requireAuth, getGmailConnectUrl);
router.get('/gmail/callback', gmailCallback);
router.post('/gmail/disconnect', requireAuth, disconnectGmail);
router.post('/gmail/sync', requireAuth, syncGmail);
router.post('/scheduled', requireAuth, scheduleEmail);
router.get('/scheduled', requireAuth, listScheduledEmails);
router.get('/scheduled/:id', requireAuth, getScheduledEmail);
router.patch('/scheduled/:id', requireAuth, updateScheduledEmail);
router.delete('/scheduled/:id', requireAuth, deleteScheduledEmail);
router.get('/tasks', requireAuth, listTasks);
router.get('/emails/:messageId', requireAuth, getEmail);
router.post('/tasks/:taskId/suggest-reply', requireAuth, suggestReply);
router.post('/tasks/:taskId/send', requireAuth, sendReply);

export default router;
