import { Router } from 'express';
import { getLeaderboard, getStats, submitFeedback } from '../controllers/landing.controller';

const router = Router();

router.get('/leaderboard', getLeaderboard);
router.get('/stats', getStats);
router.post('/feedback', submitFeedback);

export default router;
