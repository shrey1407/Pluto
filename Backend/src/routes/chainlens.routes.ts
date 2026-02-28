import { Router } from 'express';
import { getWalletInsights } from '../controllers/chainlens.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, getWalletInsights);

export default router;
