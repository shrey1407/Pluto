import { fetchYouTubeTrending } from './youtube.service';
import { fetchRedditHot } from './reddit.service';
import { fetchHackerNewsTop } from './hackernews.service';
import { fetchNewsHeadlines } from './newsapi.service';

const PER_SOURCE = 8;

/**
 * Fetch a small sample of trending data from all sources and return a text summary
 * suitable for feeding to Gemini (keywords, titles, topics).
 */
export async function getTrendingSummary(): Promise<string> {
  const [youtube, reddit, hn, news] = await Promise.all([
    fetchYouTubeTrending({ maxResults: PER_SOURCE, query: 'trending', order: 'viewCount' }).catch(() => []),
    fetchRedditHot({ subreddit: 'all', limit: PER_SOURCE }).catch(() => []),
    fetchHackerNewsTop({ list: 'topstories', limit: PER_SOURCE }).catch(() => []),
    fetchNewsHeadlines({ country: 'us', pageSize: PER_SOURCE }).catch(() => []),
  ]);

  const lines: string[] = [];

  lines.push('=== YOUTUBE (popular/trending) ===');
  youtube.forEach((i) => lines.push(`- ${i.title}`));

  lines.push('\n=== REDDIT (hot) ===');
  reddit.forEach((i) => lines.push(`- ${i.title}`));

  lines.push('\n=== HACKER NEWS (top) ===');
  hn.forEach((i) => lines.push(`- ${i.title}`));

  lines.push('\n=== NEWS (headlines) ===');
  news.forEach((i) => lines.push(`- ${i.title}`));

  return lines.join('\n');
}
