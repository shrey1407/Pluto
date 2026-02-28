import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createOrder, confirmOrder } from '../controllers/wallet.controller';

const router = Router();

router.post('/orders', requireAuth, createOrder);
router.post('/orders/:orderId/confirm', requireAuth, confirmOrder);

export default router;
