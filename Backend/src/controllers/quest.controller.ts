import { Response } from 'express';
import { Types } from 'mongoose';
import axios from 'axios';
import Sentiment from 'sentiment';
import {
  Campaign,
  Quest,
  QuestCompletion,
  User,
  LoyaltyTransaction,
  Follow,
  Post,
  PostLike,
  PostBookmark,
} from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import { COST_QUEST_ADD, QUEST_COMPLETION_REWARD_POINTS } from '../utils/constants';
import twitterAPI, { extractTweetId, extractTwitterUsername } from '../utils/twitterApi';
import type { QuestType } from '../models/Quest';

const QUEST_TYPES: QuestType[] = [
  'follow_twitter',
  'retweet_tweet',
  'tweet_tag',
  'agora_follow',
  'agora_like_post',
  'agora_comment',
  'agora_bookmark_post',
];

/** Extract MongoDB ObjectId from requiredLink (plain id or URL like /agora/thread/507f...). */
function extractAgoraId(link: string): string | null {
  const trimmed = String(link || '').trim();
  const match = trimmed.match(/([a-f0-9]{24})/i);
  return match ? match[1]! : null;
}

/** Resolve Twitter username to rest_id via RapidAPI (avoids 402 from official Twitter API). */
async function getRestIdByUsername(username: string): Promise<string | null> {
  const rapidKey = process.env.RAPIDAPI_KEY?.trim();
  if (!rapidKey) return null;
  try {
    const resp = await axios.get('https://twitter241.p.rapidapi.com/user', {
      params: { username },
      headers: {
        'x-rapidapi-key': rapidKey,
        'x-rapidapi-host': 'twitter241.p.rapidapi.com',
      },
    });
    const r = resp.data as Record<string, unknown>;
    const result = r?.result as { data?: { user?: { result?: { rest_id?: string } } } } | undefined;
    const restId = result?.data?.user?.result?.rest_id;
    return restId ? String(restId) : null;
  } catch {
    return null;
  }
}

interface TweetLegacy {
  full_text?: string;
  entities?: { user_mentions?: Array<{ screen_name?: string }> };
}
interface TweetEntryContent {
  entryId?: string;
  content?: { itemContent?: { tweet_results?: { result?: { legacy?: TweetLegacy } } } };
}

/** POST /api/campaigns/:campaignId/quests - Add quest to campaign (costs 50 loyalty points). */
export const addQuestToCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { campaignId } = req.params;
    const { title, description, requiredLink, type } = req.body;

    if (!Types.ObjectId.isValid(campaignId)) {
      res.status(400).json({ success: false, message: 'Invalid campaign id' });
      return;
    }

    if (!title || !description || !type) {
      res.status(400).json({
        success: false,
        message: 'title, description, and type are required',
      });
      return;
    }
    const isAgoraFollowNoLink = type === 'agora_follow' && (requiredLink == null || String(requiredLink).trim() === '');
    if (!isAgoraFollowNoLink && (requiredLink == null || String(requiredLink).trim() === '')) {
      res.status(400).json({
        success: false,
        message: 'requiredLink is required for this quest type',
      });
      return;
    }

    if (!QUEST_TYPES.includes(type)) {
      res.status(400).json({
        success: false,
        message: `type must be one of: ${QUEST_TYPES.join(', ')}`,
      });
      return;
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    if (campaign.owner.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to add quests to this campaign' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.loyaltyPoints < COST_QUEST_ADD) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. Required: ${COST_QUEST_ADD}, available: ${user.loyaltyPoints}`,
      });
      return;
    }

    const linkValue = isAgoraFollowNoLink ? 'campaign_creator' : String(requiredLink).trim();
    const newQuest = new Quest({
      title: String(title).trim(),
      description: String(description).trim(),
      requiredLink: linkValue,
      campaignId: new Types.ObjectId(campaignId),
      type,
    });
    await newQuest.save();

    campaign.quests.push(newQuest._id);
    await campaign.save();

    const newBalance = user.loyaltyPoints - COST_QUEST_ADD;
    await User.findByIdAndUpdate(userId, { loyaltyPoints: newBalance });

    await LoyaltyTransaction.create({
      user: new Types.ObjectId(userId),
      type: 'campaign_quest_add',
      amount: -COST_QUEST_ADD,
      balanceAfter: newBalance,
      referenceType: 'Quest',
      referenceId: newQuest._id,
      metadata: { campaignId },
    });

    const populated = await Quest.findById(newQuest._id).populate('campaignId', 'name').lean();

    res.status(201).json({
      success: true,
      data: { quest: populated ?? newQuest, newBalance },
      message: `Quest added. ${COST_QUEST_ADD} loyalty points deducted.`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to add quest',
    });
  }
};

/** GET /api/quests - List quests (optional ?campaignId=id). */
export const listQuests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    const filter =
      campaignId && Types.ObjectId.isValid(campaignId)
        ? { campaignId: new Types.ObjectId(campaignId) }
        : {};

    const quests = await Quest.find(filter)
      .populate('campaignId', 'name description owner')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: { quests } });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to list quests',
    });
  }
};

/** GET /api/quests/:id - Get one quest. */
export const getQuest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid quest id' });
      return;
    }

    const quest = await Quest.findById(id).populate('campaignId', 'name description owner').lean();

    if (!quest) {
      res.status(404).json({ success: false, message: 'Quest not found' });
      return;
    }

    res.json({ success: true, data: { quest } });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get quest',
    });
  }
};

/** PATCH /api/quests/:id - Update quest (campaign owner only). */
export const updateQuest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid quest id' });
      return;
    }

    const quest = await Quest.findById(id).populate('campaignId');
    if (!quest) {
      res.status(404).json({ success: false, message: 'Quest not found' });
      return;
    }

    const campaign = await Campaign.findById(quest.campaignId);
    if (!campaign || campaign.owner.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to update this quest' });
      return;
    }

    if (req.body.title !== undefined) quest.title = req.body.title;
    if (req.body.description !== undefined) quest.description = req.body.description;
    if (req.body.requiredLink !== undefined) quest.requiredLink = req.body.requiredLink;
    if (req.body.type !== undefined && QUEST_TYPES.includes(req.body.type)) {
      quest.type = req.body.type;
    }

    await quest.save();
    const populated = await Quest.findById(quest._id).populate('campaignId', 'name').lean();

    res.json({ success: true, data: { quest: populated ?? quest } });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to update quest',
    });
  }
};

/** DELETE /api/quests/:id - Delete quest (campaign owner only). */
export const deleteQuest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid quest id' });
      return;
    }

    const quest = await Quest.findById(id);
    if (!quest) {
      res.status(404).json({ success: false, message: 'Quest not found' });
      return;
    }

    const campaign = await Campaign.findById(quest.campaignId);
    if (!campaign || campaign.owner.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not authorized to delete this quest' });
      return;
    }

    await Campaign.findByIdAndUpdate(quest.campaignId, { $pull: { quests: quest._id } });
    await Quest.findByIdAndDelete(id);

    res.json({ success: true, message: 'Quest deleted successfully' });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to delete quest',
    });
  }
};

/** POST /api/quests/:id/verify - Verify quest completion (follow_twitter, tweet_tag supported). */
export const verifyQuest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const questId = req.params.id;
    const userId = req.user!.id;
    const tweetUrl = req.query.tweetUrl as string | undefined;

    if (!Types.ObjectId.isValid(questId)) {
      res.status(400).json({ success: false, message: 'Invalid quest id' });
      return;
    }

    const quest = await Quest.findById(questId);
    if (!quest) {
      res.status(404).json({ success: false, message: 'Quest not found' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const twitterQuestTypes: QuestType[] = ['follow_twitter', 'retweet_tweet', 'tweet_tag'];
    if (twitterQuestTypes.includes(quest.type) && (!user.twitterId || user.twitterId === 'pending')) {
      res.status(400).json({ success: false, message: 'User has not linked Twitter' });
      return;
    }

    const alreadyCompleted = await QuestCompletion.findOne({
      user: new Types.ObjectId(userId),
      quest: quest._id,
    });
    if (alreadyCompleted) {
      res.status(400).json({ success: false, message: 'Quest already completed' });
      return;
    }

    let success = false;
    const pointsToAward = QUEST_COMPLETION_REWARD_POINTS;

    if (quest.type === 'follow_twitter') {
      const targetUsername = extractTwitterUsername(quest.requiredLink);
      if (!targetUsername) {
        res.status(400).json({ success: false, message: 'Invalid Twitter profile link in quest' });
        return;
      }

      let twitterUser: string | null = await getRestIdByUsername(targetUsername);
      if (!twitterUser) {
        try {
          const resp = await twitterAPI.get(`/users/by/username/${encodeURIComponent(targetUsername)}`);
          const data = resp.data as { data?: { id: string; username: string } };
          if (data?.data?.id) twitterUser = data.data.id;
        } catch {
          // Official API may return 402/403; RapidAPI already failed
        }
      }
      if (!twitterUser) {
        res.status(400).json({ success: false, message: 'Could not resolve Twitter user from username. Ensure RAPIDAPI_KEY is set.' });
        return;
      }

      const rapidKey = process.env.RAPIDAPI_KEY?.trim();
      if (!rapidKey) {
        res.status(503).json({ success: false, message: 'RAPIDAPI_KEY is required for follow verification' });
        return;
      }
      try {
        const options = {
          method: 'GET',
          url: 'https://twitter241.p.rapidapi.com/followings',
          params: { user: user.twitterId, count: 50 },
          headers: {
            'x-rapidapi-key': rapidKey,
            'x-rapidapi-host': 'twitter241.p.rapidapi.com',
          },
        };
        const response = await axios.request(options);
        const followingsData = response.data as Record<string, unknown>;
        const timeline = followingsData?.result as { timeline?: { instructions?: Array<{ entries?: unknown[] }> } } | undefined;
        const instructions = timeline?.timeline?.instructions ?? [];
        const entries = instructions.find((inst: { entries?: unknown[] }) => inst.entries)?.entries ?? [];
        const followings = (entries as Array<{ content?: { itemContent?: { user_results?: { result?: { rest_id?: string } } } } }>)
          .map((entry) => entry.content?.itemContent?.user_results?.result?.rest_id)
          .filter(Boolean) as string[];

        if (followings.includes(twitterUser)) {
          success = true;
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 402) {
          res.status(402).json({ success: false, message: 'RapidAPI returned 402 (payment/credits required). Check your RapidAPI subscription for the followings endpoint.' });
          return;
        }
        throw err;
      }
    } else if (quest.type === 'tweet_tag') {
      if (!tweetUrl) {
        res.status(400).json({ success: false, message: 'Tweet URL is required (query: tweetUrl)' });
        return;
      }

      const tweetId = extractTweetId(tweetUrl) ?? tweetUrl.match(/status\/(\d+)/)?.[1];
      if (!tweetId) {
        res.status(400).json({ success: false, message: 'Invalid Tweet URL' });
        return;
      }

      const options = {
        method: 'GET',
        url: 'https://twitter241.p.rapidapi.com/tweet',
        params: { pid: tweetId },
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
          'x-rapidapi-host': 'twitter241.p.rapidapi.com',
        },
      };
      const response = await axios.request(options);
      const resData = response.data as Record<string, unknown>;

      // Tweet response parsed below via conv/thread/entries
      const conv = resData?.data as Record<string, unknown> | undefined;
      const thread = conv?.threaded_conversation_with_injections_v2 as { instructions?: Array<{ type?: string; entries?: TweetEntryContent[] }> } | undefined;
      const instructions = thread?.instructions ?? [];
      const entries = instructions.find((ins) => ins.type === 'TimelineAddEntries')?.entries ?? [];
      const tweetEntry = entries.find((e) => e.entryId?.startsWith('tweet-'));

      if (!tweetEntry) {
        res.status(400).json({ success: false, message: 'Could not fetch Tweet details' });
        return;
      }

      const tweetData = tweetEntry.content?.itemContent?.tweet_results?.result?.legacy;
      if (!tweetData) {
        res.status(400).json({ success: false, message: 'Tweet data missing in response' });
        return;
      }

      const mentions = tweetData.entities?.user_mentions ?? [];
      const tweetText = tweetData.full_text ?? '';
      const handleMatch = quest.requiredLink.match(/x\.com\/([^/]+)/) ?? quest.requiredLink.match(/twitter\.com\/([^/]+)/);
      if (!handleMatch) {
        res.status(400).json({ success: false, message: 'Invalid required_link in quest' });
        return;
      }
      const requiredHandle = handleMatch[1]!.toLowerCase();
      const tagged = mentions.some((m) => (m.screen_name ?? '').toLowerCase() === requiredHandle);

      const sentiment = new Sentiment();
      const analysis = sentiment.analyze(tweetText);
      if (tagged && analysis.score >= 0) {
        success = true;
      } else if (tagged && analysis.score < 0) {
        res.json({
          success: true,
          data: { message: 'Tweet sentiment is not positive. No points awarded.' },
        });
        return;
      }
    } else if (quest.type === 'retweet_tweet') {
      const tweetId = extractTweetId(quest.requiredLink) ?? quest.requiredLink.match(/status\/(\d+)/)?.[1] ?? quest.requiredLink.match(/^(\d+)$/)?.[1];
      if (!tweetId) {
        res.status(400).json({ success: false, message: 'Invalid tweet link. Provide a tweet URL (e.g. https://twitter.com/user/status/123) or tweet ID.' });
        return;
      }

      const rapidKey = process.env.RAPIDAPI_KEY?.trim();
      if (!rapidKey) {
        res.status(503).json({ success: false, message: 'RAPIDAPI_KEY is required for retweet verification' });
        return;
      }

      try {
        const response = await axios.get('https://twitter241.p.rapidapi.com/retweets', {
          params: { pid: tweetId, count: 40 },
          headers: {
            'x-rapidapi-key': rapidKey,
            'x-rapidapi-host': 'twitter241.p.rapidapi.com',
          },
        });
        const resData = response.data as Record<string, unknown>;
        const result = resData?.result as { timeline?: { instructions?: Array<{ type?: string; entries?: unknown[] }> } } | undefined;
        const instructions = result?.timeline?.instructions ?? [];
        const timelineAddEntries = instructions.find((inst: { type?: string }) => inst.type === 'TimelineAddEntries');
        const entries = (timelineAddEntries as { entries?: unknown[] } | undefined)?.entries ?? [];

        const retweeterIds = (entries as Array<{
          entryId?: string;
          content?: { itemContent?: { itemType?: string; user_results?: { result?: { rest_id?: string } } } };
        }>)
          .filter((e) => e.content?.itemContent?.itemType === 'TimelineUser' && e.content?.itemContent?.user_results?.result?.rest_id)
          .map((e) => String(e.content!.itemContent!.user_results!.result!.rest_id!));

        if (user.twitterId && retweeterIds.includes(user.twitterId)) {
          success = true;
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 402) {
          res.status(402).json({ success: false, message: 'RapidAPI returned 402 (payment/credits required). Check your RapidAPI subscription for the retweets endpoint.' });
          return;
        }
        throw err;
      }
    } else if (quest.type === 'agora_follow') {
      let targetUserId: string | null = null;
      if (
        !quest.requiredLink ||
        String(quest.requiredLink).trim() === '' ||
        String(quest.requiredLink).trim() === 'campaign_creator'
      ) {
        const campaign = await Campaign.findById(quest.campaignId);
        if (campaign?.owner) targetUserId = campaign.owner.toString();
      } else {
        targetUserId = extractAgoraId(quest.requiredLink);
      }
      if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
        res.status(400).json({ success: false, message: 'Invalid user. Campaign creator not found or invalid user link.' });
        return;
      }
      const follow = await Follow.findOne({
        follower: new Types.ObjectId(userId),
        following: new Types.ObjectId(targetUserId),
      });
      if (follow) success = true;
    } else if (quest.type === 'agora_like_post') {
      const postId = extractAgoraId(quest.requiredLink);
      if (!postId || !Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, message: 'Invalid post link. Provide a cast ID or thread URL.' });
        return;
      }
      const like = await PostLike.findOne({
        user: new Types.ObjectId(userId),
        post: new Types.ObjectId(postId),
      });
      if (like) success = true;
    } else if (quest.type === 'agora_comment') {
      const postId = extractAgoraId(quest.requiredLink);
      if (!postId || !Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, message: 'Invalid post link. Provide a cast ID or thread URL.' });
        return;
      }
      const reply = await Post.findOne({
        user: new Types.ObjectId(userId),
        parentPost: new Types.ObjectId(postId),
      });
      if (reply) success = true;
    } else if (quest.type === 'agora_bookmark_post') {
      const postId = extractAgoraId(quest.requiredLink);
      if (!postId || !Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, message: 'Invalid post link. Provide a cast ID or thread URL.' });
        return;
      }
      const bookmark = await PostBookmark.findOne({
        user: new Types.ObjectId(userId),
        post: new Types.ObjectId(postId),
      });
      if (bookmark) success = true;
    } else {
      res.status(400).json({ success: false, message: 'Unknown quest type' });
      return;
    }

    if (!success) {
      res.status(400).json({ success: false, message: 'Quest not yet completed' });
      return;
    }

    const campaign = await Campaign.findById(quest.campaignId);
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const newBalance = user.loyaltyPoints + pointsToAward;

    await User.findByIdAndUpdate(userId, {
      $push: { completedQuests: quest._id },
      loyaltyPoints: newBalance,
    });

    await QuestCompletion.create({
      user: new Types.ObjectId(userId),
      quest: quest._id,
      campaign: campaign._id,
      pointsAwarded: pointsToAward,
    });

    await LoyaltyTransaction.create({
      user: new Types.ObjectId(userId),
      type: 'quest_complete',
      amount: pointsToAward,
      balanceAfter: newBalance,
      referenceType: 'Quest',
      referenceId: quest._id,
    });

    const alreadyParticipant = campaign.participants.some((p) => p.toString() === userId);
    if (!alreadyParticipant) {
      await Campaign.findByIdAndUpdate(campaign._id, {
        $push: { participants: new Types.ObjectId(userId) },
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Quest verified successfully',
        points_awarded: pointsToAward,
        total_points: newBalance,
        quest_id: quest._id,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Quest verification failed',
    });
  }
};
