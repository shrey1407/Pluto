import { Response } from 'express';
import { Types } from 'mongoose';
import {
  Campaign,
  User,
  LoyaltyTransaction,
  QuestCompletion,
} from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import { COST_CAMPAIGN_CREATE } from '../utils/constants';

/** POST /api/campaigns - Create campaign (costs 100 loyalty points). */
export const createCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, description, expiryDays } = req.body;

    if (!name || !description) {
      res.status(400).json({
        success: false,
        message: 'Name and description are required',
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.loyaltyPoints < COST_CAMPAIGN_CREATE) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. Required: ${COST_CAMPAIGN_CREATE}, available: ${user.loyaltyPoints}`,
      });
      return;
    }

    let expiryDate: Date | undefined;
    if (expiryDays != null && !Number.isNaN(Number(expiryDays))) {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + Number(expiryDays));
    }

    const campaign = new Campaign({
      name: name.trim(),
      description: description.trim(),
      owner: new Types.ObjectId(userId),
      quests: [],
      participants: [],
      costInPoints: COST_CAMPAIGN_CREATE,
      status: 'active',
      expiryDate,
    });
    await campaign.save();

    const newBalance = user.loyaltyPoints - COST_CAMPAIGN_CREATE;
    await User.findByIdAndUpdate(userId, { loyaltyPoints: newBalance });

    await LoyaltyTransaction.create({
      user: new Types.ObjectId(userId),
      type: 'campaign_launch',
      amount: -COST_CAMPAIGN_CREATE,
      balanceAfter: newBalance,
      referenceType: 'Campaign',
      referenceId: campaign._id,
    });

    const populated = await Campaign.findById(campaign._id)
      .populate('owner', 'username email')
      .lean();

    res.status(201).json({
      success: true,
      data: { campaign: populated ?? campaign, newBalance },
      message: `Campaign created. ${COST_CAMPAIGN_CREATE} loyalty points deducted.`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to create campaign',
    });
  }
};

/** GET /api/campaigns - List campaigns (optional ?owner=userId). Excludes expired by status or by expiry date. */
export const listCampaigns = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.query.owner as string | undefined;
    const now = new Date();
    const filter: Record<string, unknown> =
      ownerId && Types.ObjectId.isValid(ownerId)
        ? { owner: new Types.ObjectId(ownerId) }
        : {};
    filter.status = { $ne: 'expired' };
    // Exclude campaigns whose expiry date has passed (even if status is still 'active')
    filter.$or = [
      { expiryDate: { $exists: false } },
      { expiryDate: null },
      { expiryDate: { $gt: now } },
    ];

    const campaigns = await Campaign.find(filter)
      .populate('owner', 'username email')
      .populate('quests')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    res.json({ success: true, data: { campaigns } });
  } catch (err) {
    console.error('listCampaigns error:', err);
    const message = err instanceof Error ? err.message : 'Failed to list campaigns';
    res.status(500).json({
      success: false,
      message,
    });
  }
};

/** GET /api/campaigns/:id - Get one campaign. When authenticated, includes completedQuestIds for current user. */
export const getCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid campaign id' });
      return;
    }

    const campaign = await Campaign.findById(id)
      .populate('owner', 'username email')
      .populate('quests')
      .populate('participants', 'username email')
      .lean();

    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    let completedQuestIds: string[] = [];
    if (req.user?.id && Types.ObjectId.isValid(req.user.id)) {
      const completions = await QuestCompletion.find({
        user: new Types.ObjectId(req.user.id),
        campaign: new Types.ObjectId(id),
      })
        .select('quest')
        .lean();
      completedQuestIds = completions.map((c) => String(c.quest));
    }

    res.json({ success: true, data: { campaign, completedQuestIds } });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get campaign',
    });
  }
};

/** PATCH /api/campaigns/:id - Update campaign (owner only). */
export const updateCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid campaign id' });
      return;
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    if (campaign.owner.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to update this campaign' });
      return;
    }

    if (req.body.name !== undefined) campaign.name = req.body.name;
    if (req.body.description !== undefined) campaign.description = req.body.description;
    if (req.body.status !== undefined) campaign.status = req.body.status;
    if (req.body.expiryDate !== undefined) campaign.expiryDate = req.body.expiryDate;

    await campaign.save();
    const populated = await Campaign.findById(campaign._id)
      .populate('owner', 'username email')
      .populate('quests')
      .lean();

    res.json({ success: true, data: { campaign: populated ?? campaign } });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to update campaign',
    });
  }
};

/** DELETE /api/campaigns/:id - Delete campaign (owner only). */
export const deleteCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid campaign id' });
      return;
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    if (campaign.owner.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to delete this campaign' });
      return;
    }

    await Campaign.findByIdAndDelete(id);
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to delete campaign',
    });
  }
};
