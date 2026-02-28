import axios from 'axios';
import type { TrendCraftItem } from '../types';

const BASE = 'https://hacker-news.firebaseio.com/v0';

interface HNItem {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  by?: string;
  time?: number;
  descendants?: number;
  type?: string;
  text?: string;
}

/**
 * Fetch top or best stories from Hacker News. No API key required.
 */
export async function fetchHackerNewsTop(options: {
  list?: 'topstories' | 'beststories' | 'newstories';
  limit?: number;
}): Promise<TrendCraftItem[]> {
  const list = options.list ?? 'topstories';
  const limit = Math.min(50, Math.max(1, options.limit ?? 15));

  const { data: storyIds } = await axios.get<number[]>(`${BASE}/${list}.json`, {
    timeout: 10000,
  });

  const ids = (storyIds ?? []).slice(0, limit);
  const items = await Promise.all(
    ids.map(async (id) => {
      const { data: item } = await axios.get<HNItem | null>(`${BASE}/item/${id}.json`, {
        timeout: 5000,
      });
      return item;
    })
  );

  return items
    .filter((i): i is HNItem => i != null && (i.type === 'story' || i.type === 'job'))
    .map((i) => ({
      source: 'hackernews' as const,
      id: String(i.id),
      title: i.title ?? '',
      url: i.url ?? (i.id ? `https://news.ycombinator.com/item?id=${i.id}` : undefined),
      description: i.text?.slice(0, 300) ?? undefined,
      publishedAt: i.time ? new Date(i.time * 1000).toISOString() : undefined,
      metadata: {
        by: i.by,
        score: i.score,
        descendants: i.descendants,
        type: i.type,
      },
    }));
}
