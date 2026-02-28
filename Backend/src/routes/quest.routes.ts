import { Router } from 'express';
import {
  listQuests,
  getQuest,
  updateQuest,
  deleteQuest,
  verifyQuest,
} from '../controllers/quest.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', listQuests);
router.get('/:id', getQuest);
router.patch('/:id', requireAuth, updateQuest);
router.delete('/:id', requireAuth, deleteQuest);
router.post('/:id/verify', requireAuth, verifyQuest);

export default router;
