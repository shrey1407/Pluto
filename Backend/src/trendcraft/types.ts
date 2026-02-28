/** Unified feed item across YouTube, Reddit, Hacker News, NewsAPI. */
export type TrendCraftSource = 'youtube' | 'reddit' | 'hackernews' | 'news';

export interface TrendCraftItem {
  source: TrendCraftSource;
  id: string;
  title: string;
  url?: string;
  description?: string;
  publishedAt?: string; // ISO 8601
  metadata: Record<string, unknown>;
}
