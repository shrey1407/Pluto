import { Router } from 'express';
import {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
} from '../controllers/campaign.controller';
import { addQuestToCampaign } from '../controllers/quest.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, createCampaign);
router.get('/', listCampaigns);
router.get('/:id', optionalAuth, getCampaign);
router.patch('/:id', requireAuth, updateCampaign);
router.delete('/:id', requireAuth, deleteCampaign);

/** Add quest to campaign (costs 50 loyalty points). */
router.post('/:campaignId/quests', requireAuth, addQuestToCampaign);

export default router;
