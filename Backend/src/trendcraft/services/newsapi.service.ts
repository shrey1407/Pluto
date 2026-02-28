import axios from 'axios';
import type { TrendCraftItem } from '../types';

const BASE = 'https://newsapi.org/v2';

interface NewsApiArticle {
  title: string;
  url?: string;
  description?: string;
  publishedAt?: string;
  source?: { name?: string; id?: string };
  author?: string;
  content?: string;
  urlToImage?: string;
}

/**
 * Fetch top headlines from NewsAPI. Requires NEWS_API_KEY. Returns empty array if key missing.
 */
export async function fetchNewsHeadlines(options: {
  country?: string;
  category?: string;
  pageSize?: number;
  page?: number;
  q?: string;
}): Promise<TrendCraftItem[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];

  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 15));
  const params: Record<string, string | number> = {
    apiKey,
    pageSize,
    page: Math.max(1, options.page ?? 1),
  };
  if (options.country) params.country = options.country;
  if (options.category) params.category = options.category;
  if (options.q?.trim()) params.q = options.q.trim();

  const { data } = await axios.get<{ articles?: NewsApiArticle[]; status?: string }>(
    `${BASE}/top-headlines`,
    { params, timeout: 10000 }
  );

  const articles = data.articles ?? [];
  return articles.map((a, index) => ({
    source: 'news' as const,
    id: a.url ? `news-${index}-${encodeURIComponent(a.url)}` : `news-${index}-${Date.now()}`,
    title: a.title ?? '',
    url: a.url,
    description: a.description?.slice(0, 300) ?? undefined,
    publishedAt: a.publishedAt,
    metadata: {
      source: a.source?.name,
      author: a.author,
      urlToImage: a.urlToImage,
    },
  }));
}
