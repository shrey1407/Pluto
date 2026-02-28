import { Router } from 'express';
import helloRoutes from './hello.routes';
import authRoutes from './auth.routes';
import campaignRoutes from './campaign.routes';
import questRoutes from './quest.routes';
import dailyClaimRoutes from './dailyClaim.routes';
import agoraRoutes from '../agora/routes';
import chainlensRoutes from './chainlens.routes';
import trendcraftRoutes from '../trendcraft/routes';
import { generateContent, getContentSuggestions, getFeedWithDeduction } from '../trendcraft/controller';
import { requireAuth } from '../middleware/auth.middleware';
import pulsebotRoutes from './pulsebot.routes';
import walletRoutes from './wallet.routes';
import landingRoutes from './landing.routes';
import emailIntegrationRoutes from './emailIntegration.routes';

const router = Router();

router.use('/hello', helloRoutes);
router.use('/auth', authRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/quests', questRoutes);
router.use('/daily-claim', dailyClaimRoutes);
router.use('/agora', agoraRoutes);
router.use('/chainlens', chainlensRoutes);
// Register auth routes directly so they always match (avoids 404 from sub-router)
router.post('/trendcraft/generate-content', requireAuth, generateContent);
router.get('/trendcraft/content-suggestions', requireAuth, getContentSuggestions);
router.get('/trendcraft/feed', requireAuth, getFeedWithDeduction);
router.use('/trendcraft', trendcraftRoutes);
router.use('/pulsebot', pulsebotRoutes);
router.use('/wallet', walletRoutes);
router.use('/landing', landingRoutes);
router.use('/email-integration', emailIntegrationRoutes);

// 404 for unmatched /api/* (return JSON)
router.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

export default router;
