import axios from 'axios';
import type { TrendCraftItem } from '../types';

const BASE = 'https://www.googleapis.com/youtube/v3';

interface YouTubeSearchItem {
  id: { videoId?: string };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelTitle: string;
    thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
  };
  statistics?: { viewCount?: string; likeCount?: string };
}

/**
 * Fetch popular/trending-style videos via search (order=viewCount or relevance).
 * Requires YOUTUBE_API_KEY. Returns empty array if key missing.
 */
export async function fetchYouTubeTrending(options: {
  maxResults?: number;
  query?: string;
  order?: 'viewCount' | 'relevance' | 'date';
}): Promise<TrendCraftItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const maxResults = Math.min(25, Math.max(1, options.maxResults ?? 10));
  const order = options.order ?? 'viewCount';
  const q = options.query?.trim() || 'trending';

  const { data } = await axios.get<{
    items?: YouTubeSearchItem[];
  }>(`${BASE}/search`, {
    params: {
      part: 'snippet',
      type: 'video',
      maxResults,
      order,
      q,
      key: apiKey,
    },
    timeout: 10000,
  });

  const items = data.items ?? [];
  const videoIds = items.map((i) => i.id?.videoId).filter(Boolean) as string[];
  let statsMap: Record<string, { viewCount?: string; likeCount?: string }> = {};

  if (videoIds.length > 0) {
    const videosRes = await axios.get<{ items?: { id: string; statistics?: { viewCount?: string; likeCount?: string } }[] }>(
      `${BASE}/videos`,
      {
        params: { part: 'statistics', id: videoIds.join(','), key: apiKey },
        timeout: 10000,
      }
    );
    const videos = videosRes.data.items ?? [];
    videos.forEach((v) => {
      if (v.id) statsMap[v.id] = v.statistics ?? {};
    });
  }

  return items
    .filter((i) => i.id?.videoId)
    .map((i) => {
      const vid = i.id!.videoId!;
      const stats = statsMap[vid] ?? {};
      return {
        source: 'youtube' as const,
        id: vid,
        title: i.snippet?.title ?? '',
        url: `https://www.youtube.com/watch?v=${vid}`,
        description: i.snippet?.description?.slice(0, 300) ?? undefined,
        publishedAt: i.snippet?.publishedAt,
        metadata: {
          channelTitle: i.snippet?.channelTitle,
          viewCount: stats.viewCount ? parseInt(stats.viewCount, 10) : undefined,
          likeCount: stats.likeCount ? parseInt(stats.likeCount, 10) : undefined,
        },
      };
    });
}
