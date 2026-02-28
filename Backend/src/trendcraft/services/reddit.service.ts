import axios from 'axios';
import type { TrendCraftItem } from '../types';

const BASE = 'https://www.reddit.com';

interface RedditListingChild {
  data: {
    id: string;
    title: string;
    url: string;
    selftext?: string;
    score: number;
    num_comments: number;
    created_utc: number;
    permalink: string;
    subreddit: string;
    author?: string;
    thumbnail?: string;
    is_self?: boolean;
  };
}

/**
 * Fetch hot posts from a subreddit. No API key required; Reddit requires a descriptive User-Agent.
 * REDDIT_USER_AGENT env recommended (e.g. "TrendCraft/1.0").
 */
export async function fetchRedditHot(options: {
  subreddit?: string;
  limit?: number;
}): Promise<TrendCraftItem[]> {
  const subreddit = options.subreddit?.trim() || 'all';
  const limit = Math.min(50, Math.max(1, options.limit ?? 15));
  const userAgent = process.env.REDDIT_USER_AGENT || 'TrendCraft/1.0';

  const { data } = await axios.get<{ data?: { children?: RedditListingChild[] } }>(
    `${BASE}/r/${encodeURIComponent(subreddit)}/hot.json`,
    {
      params: { limit },
      headers: { 'User-Agent': userAgent },
      timeout: 10000,
    }
  );

  const children = data.data?.children ?? [];
  return children.map((c) => {
    const d = c.data;
    const url = d.url?.startsWith('http') ? d.url : `https://www.reddit.com${d.permalink || ''}`;
    return {
      source: 'reddit' as const,
      id: d.id,
      title: d.title ?? '',
      url,
      description: d.selftext?.slice(0, 300) ?? undefined,
      publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
      metadata: {
        subreddit: d.subreddit,
        author: d.author,
        score: d.score,
        num_comments: d.num_comments,
        permalink: d.permalink,
      },
    };
  });
}
