import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { User, LoyaltyTransaction } from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import { COST_TRENDCRAFT_GEMINI } from '../utils/constants';
import { cacheGet, cacheSet, CACHE_TTL } from '../utils/redis.cache';
import {
  fetchYouTubeTrending,
  fetchRedditHot,
  fetchHackerNewsTop,
  fetchNewsHeadlines,
  generateWithGemini,
  getTrendingSummary,
} from './services';
import type { TrendCraftItem } from './types';

const TRENDCRAFT_CACHE_TTL = CACHE_TTL.TRENDCRAFT_MINUTES * 60;

/** Deduct loyalty points for TrendCraft Gemini feature. Returns { ok: true, newBalance } or { ok: false }. */
async function deductTrendCraftPoints(userId: string): Promise<{ ok: boolean; newBalance?: number }> {
  const user = await User.findById(userId);
  if (!user) return { ok: false };
  const cost = COST_TRENDCRAFT_GEMINI;
  if (user.loyaltyPoints < cost) return { ok: false };
  const newBalance = user.loyaltyPoints - cost;
  await User.findByIdAndUpdate(userId, { loyaltyPoints: newBalance });
  await LoyaltyTransaction.create({
    user: new Types.ObjectId(userId),
    type: 'feature_use',
    amount: -cost,
    balanceAfter: newBalance,
    referenceType: 'Feature',
    metadata: { feature: 'trendcraft_gemini' },
  });
  return { ok: true, newBalance };
}

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 25;

async function buildFeedData(req: Request): Promise<{ items: TrendCraftItem[]; sources: string[] }> {
  const sourcesParam = (req.query.sources as string)?.toLowerCase() ?? 'youtube,reddit,hackernews,news';
  const sources = sourcesParam.split(',').map((s) => s.trim()).filter(Boolean);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_LIMIT));

  const results: TrendCraftItem[] = [];
  const promises: Promise<TrendCraftItem[]>[] = [];

  if (sources.includes('youtube')) {
    promises.push(fetchYouTubeTrending({ maxResults: limit }).catch(() => []));
  }
  if (sources.includes('reddit')) {
    promises.push(
      fetchRedditHot({ subreddit: (req.query.subreddit as string) || 'all', limit }).catch(() => [])
    );
  }
  if (sources.includes('hackernews')) {
    promises.push(
      fetchHackerNewsTop({ list: (req.query.hn_list as 'topstories' | 'beststories') || 'topstories', limit }).catch(() => [])
    );
  }
  if (sources.includes('news')) {
    promises.push(
      fetchNewsHeadlines({
        country: (req.query.country as string) || 'us',
        category: req.query.category as string | undefined,
        pageSize: limit,
      }).catch(() => [])
    );
  }

  const arrays = await Promise.all(promises);
  arrays.forEach((arr) => results.push(...arr));

  results.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  return {
    items: results,
    sources: sources.filter((s) => ['youtube', 'reddit', 'hackernews', 'news'].includes(s)),
  };
}

function feedCacheKey(req: Request): string {
  const sourcesParam = (req.query.sources as string)?.toLowerCase() ?? 'youtube,reddit,hackernews,news';
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_LIMIT));
  const subreddit = (req.query.subreddit as string) || 'all';
  const country = (req.query.country as string) || 'us';
  const category = (req.query.category as string) || '';
  return `trendcraft:feed:${sourcesParam}:${limit}:${subreddit}:${country}:${category}`;
}

/**
 * GET /api/trendcraft/feed - Aggregated feed (no auth, no deduction). Used by sub-router when auth route is not matched.
 */
export const getFeed = async (req: Request, res: Response): Promise<void> => {
  try {
    const key = feedCacheKey(req);
    const cached = await cacheGet(key);
    if (cached) {
      try {
        const data = JSON.parse(cached) as { items: TrendCraftItem[]; sources: string[] };
        res.json({ success: true, data });
        return;
      } catch {
        // invalid cache, fall through
      }
    }
    const data = await buildFeedData(req);
    await cacheSet(key, JSON.stringify(data), TRENDCRAFT_CACHE_TTL);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to fetch feed',
    });
  }
};

/**
 * GET /api/trendcraft/feed (auth) - Load feed and deduct loyalty points. Requires auth.
 */
export const getFeedWithDeduction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const deduction = await deductTrendCraftPoints(userId);
    if (!deduction.ok) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. Loading feed costs ${COST_TRENDCRAFT_GEMINI} points.`,
      });
      return;
    }
    const key = feedCacheKey(req);
    const cached = await cacheGet(key);
    let data: { items: TrendCraftItem[]; sources: string[] };
    if (cached) {
      try {
        data = JSON.parse(cached) as { items: TrendCraftItem[]; sources: string[] };
      } catch {
        data = await buildFeedData(req);
        await cacheSet(key, JSON.stringify(data), TRENDCRAFT_CACHE_TTL);
      }
    } else {
      data = await buildFeedData(req);
      await cacheSet(key, JSON.stringify(data), TRENDCRAFT_CACHE_TTL);
    }
    res.json({
      success: true,
      data: {
        ...data,
        newBalance: deduction.newBalance,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to fetch feed',
    });
  }
};

/**
 * GET /api/trendcraft/youtube - YouTube trending/popular videos.
 * Query: q (search), order (viewCount|relevance|date), limit.
 */
export const getYouTube = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(25, Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_LIMIT));
    const q = (req.query.q as string)?.trim() || 'trending';
    const order = (req.query.order as 'viewCount' | 'relevance' | 'date') || 'viewCount';
    const key = `trendcraft:youtube:${q}:${order}:${limit}`;
    const cached = await cacheGet(key);
    if (cached) {
      try {
        const data = JSON.parse(cached) as { source: string; items: TrendCraftItem[] };
        res.json({ success: true, data });
        return;
      } catch {
        // fall through
      }
    }
    const items = await fetchYouTubeTrending({ maxResults: limit, query: q, order });
    const data = { source: 'youtube' as const, items };
    await cacheSet(key, JSON.stringify(data), TRENDCRAFT_CACHE_TTL);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to fetch YouTube',
    });
  }
};

/**
 * GET /api/trendcraft/reddit - Reddit hot posts.
 * Query: subreddit (default all), limit.
 */
export const getReddit = async (req: Request, res: Response): Promise<void> => {
  try {
    const subreddit = (req.query.subreddit as string)?.trim() || 'all';
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_LIMIT));
    const key = `trendcraft:reddit:${subreddit}:${limit}`;
    const cached = await cacheGet(key);
    if (cached) {
      try {
        const data = JSON.parse(cached) as { source: string; subreddit: string; items: TrendCraftItem[] };
        res.json({ success: true, data });
        return;
      } catch {
        // fall through
      }
    }
    const items = await fetchRedditHot({ subreddit, limit });
    const data = { source: 'reddit' as const, subreddit, items };
    await cacheSet(key, JSON.stringify(data), TRENDCRAFT_CACHE_TTL);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to fetch Reddit',
    });
  }
};

/**
 * GET /api/trendcraft/hackernews - Hacker News top/best/new stories.
 * Query: list (topstories|beststories|newstories), limit.
 */
export const getHackerNews = async (req: Request, res: Response): Promise<void> => {
  try {
    const list = (req.query.list as 'topstories' | 'beststories' | 'newstories') || 'topstories';
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_LIMIT));
    const key = `trendcraft:hackernews:${list}:${limit}`;
    const cached = await cacheGet(key);
    if (cached) {
      try {
        const data = JSON.parse(cached) as { source: string; list: string; items: TrendCraftItem[] };
        res.json({ success: true, data });
        return;
      } catch {
        // fall through
      }
    }
    const items = await fetchHackerNewsTop({ list, limit });
    const data = { source: 'hackernews' as const, list, items };
    await cacheSet(key, JSON.stringify(data), TRENDCRAFT_CACHE_TTL);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to fetch Hacker News',
    });
  }
};

/**
 * GET /api/trendcraft/news - NewsAPI top headlines.
 * Query: country, category, pageSize, page, q.
 */
export const getNews = async (req: Request, res: Response): Promise<void> => {
  try {
    const country = (req.query.country as string)?.trim() || 'us';
    const category = (req.query.category as string)?.trim() || '';
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10) || DEFAULT_LIMIT));
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const q = (req.query.q as string)?.trim() || '';
    const key = `trendcraft:news:${country}:${category}:${pageSize}:${page}:${q}`;
    const cached = await cacheGet(key);
    if (cached) {
      try {
        const data = JSON.parse(cached) as { source: string; country: string; category?: string; page: number; items: TrendCraftItem[] };
        res.json({ success: true, data });
        return;
      } catch {
        // fall through
      }
    }
    const items = await fetchNewsHeadlines({ country, category: category || undefined, pageSize, page, q: q || undefined });
    const data = { source: 'news' as const, country, category: category || undefined, page, items };
    await cacheSet(key, JSON.stringify(data), TRENDCRAFT_CACHE_TTL);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to fetch news',
    });
  }
};

/**
 * POST /api/trendcraft/generate-content - Generate short content for Agora casts. Costs loyalty points. Requires auth.
 * Body: { keyword?: string, contentIdea?: string } (at least one required).
 */
export const generateContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const keyword = (req.body.keyword as string)?.trim();
    const contentIdea = (req.body.contentIdea as string)?.trim();
    const input = keyword || contentIdea;

    if (!input) {
      res.status(400).json({
        success: false,
        message: 'Provide keyword or contentIdea in the request body',
      });
      return;
    }

    const userId = req.user!.id;
    const deduction = await deductTrendCraftPoints(userId);
    if (!deduction.ok) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. This action costs ${COST_TRENDCRAFT_GEMINI} points.`,
      });
      return;
    }

    const trendingSummary = await getTrendingSummary();
    const prompt = `You are a social media and SEO expert. Based on the following TRENDING topics from YouTube, Reddit, Hacker News, and News (right now), generate ONE short piece of content (under 500 characters) that fits the user's topic and leverages current trends. This content will be posted on Agora (a social feed).

TRENDING DATA (titles/headlines from multiple sources):
${trendingSummary}

USER REQUEST: ${keyword ? `Keyword/topic: ${input}` : `Content idea: ${input}`}

Requirements:
- Output must be under 500 characters.
- Include relevant keywords that are currently trending where they fit naturally.
- Be engaging and shareable.
- Output ONLY the generated content text, no explanation or prefix.`;

    const generated = await generateWithGemini(prompt);

    if (!generated) {
      res.status(503).json({
        success: false,
        message: 'Content generation unavailable. Check GEMINI_API_KEY and try again.',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        content: generated,
        input: { keyword: keyword || undefined, contentIdea: contentIdea || undefined },
        loyaltyPointsDeducted: COST_TRENDCRAFT_GEMINI,
        newBalance: deduction.newBalance,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to generate content',
    });
  }
};

/**
 * GET /api/trendcraft/content-suggestions - Get 5 content type suggestions. Costs loyalty points. Requires auth.
 */
export const getContentSuggestions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const deduction = await deductTrendCraftPoints(userId);
    if (!deduction.ok) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. This action costs ${COST_TRENDCRAFT_GEMINI} points.`,
      });
      return;
    }

    const trendingSummary = await getTrendingSummary();
    const prompt = `You are a content strategy expert. Based on the TRENDING data below, suggest exactly 5 ideas for short posts or content that can be shared on Agora (a social feed). Focus on: post ideas, thread ideas, copy/marketing text ideas, or hooks that work as short text (e.g. "A short take unpacking X", "A hook for a post about Y", "An angle on Z"). Each idea must be one clear, actionable sentence tied to current trends.

TRENDING DATA:
${trendingSummary}

Output ONLY a valid JSON object with no other text, no markdown, no code fences. Format:
{"suggestions": ["first full idea here", "second full idea here", "third full idea here", "fourth full idea here", "fifth full idea here"]}
Rules: The key must be exactly "suggestions". The value must be an array of exactly 5 strings. Each string must be a complete idea sentence for short social content—nothing else. Do not put labels, keys, or numbers inside the array.`;

    const raw = await generateWithGemini(prompt, {
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    });

    if (!raw) {
      res.status(503).json({
        success: false,
        message: 'Suggestions unavailable. Check GEMINI_API_KEY and try again.',
      });
      return;
    }

    const isPlaceholder = (s: string) => {
      const t = String(s).replace(/\s+/g, ' ').trim();
      return t.length < 15 || /^[\s\-–—]*$/i.test(t) || /^[\-\–—]\s*$/.test(t);
    };

    const isMalformed = (s: string) => {
      const t = String(s).replace(/\s+/g, ' ').trim();
      if (t.length < 20) return true;
      if (/^\s*\d*\s*suggestions?\s*[:\[]/i.test(t)) return true;
      if (/^["\s]*suggestions?\s*:\s*\[?\s*["]?\s*$/i.test(t)) return true;
      if (/^[^a-zA-Z"]*$/.test(t)) return true;
      if (t.includes('":[') || t === '"' || /^["\s\d\.\-\:\[\]]+$/.test(t)) return true;
      return false;
    };

    let choices: string[] = [];
    const extractJson = (text: string): { suggestions?: unknown } | null => {
      const start = text.indexOf('{"suggestions"');
      if (start < 0) return null;
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(text.slice(start, i + 1)) as { suggestions?: unknown };
            } catch {
              return null;
            }
          }
        }
      }
      return null;
    };
    const parsed = extractJson(raw);
    if (parsed?.suggestions && Array.isArray(parsed.suggestions)) {
      choices = parsed.suggestions
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0 && !isPlaceholder(s) && !isMalformed(s))
        .slice(0, 5);
    }
    if (choices.length < 5) {
      const lines = raw
        .split(/\n/)
        .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').replace(/^["\s]+|["\s]+$/g, '').trim())
        .filter((s) => s.length > 0 && !isPlaceholder(s) && !isMalformed(s))
        .slice(0, 5);
      if (lines.length > choices.length) choices = lines;
    }
    while (choices.length < 5) choices.push('');
    choices = choices.slice(0, 5);

    res.json({
      success: true,
      data: {
        suggestions: choices.map((text, index) => ({ index: index + 1, text })),
        loyaltyPointsDeducted: COST_TRENDCRAFT_GEMINI,
        newBalance: deduction.newBalance,
      },
    });
  } catch (err) {
    console.error('[TrendCraft] getContentSuggestions error:', err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to get content suggestions',
    });
  }
};
