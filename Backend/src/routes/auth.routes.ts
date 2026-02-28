import { Router } from 'express';
import { register, login, googleAuth, getMe, updateProfile } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleAuth);
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateProfile);

export default router;
