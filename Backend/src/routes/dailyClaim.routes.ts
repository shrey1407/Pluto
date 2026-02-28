import { Router } from 'express';
import { getStatus, claim } from '../controllers/dailyClaim.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/status', requireAuth, getStatus);
router.post('/', requireAuth, claim);

export default router;
