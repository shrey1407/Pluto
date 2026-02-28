import axios from 'axios';

const twitterAPI = axios.create({
  baseURL: 'https://api.twitter.com/2',
});

twitterAPI.interceptors.request.use((config) => {
  const token = process.env.TWITTER_BEARER_TOKEN?.trim();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function extractTweetId(tweetUrl: string): string | null {
  try {
    const url = new URL(tweetUrl);
    const parts = url.pathname.split('/');
    const statusIndex = parts.findIndex((p) => p === 'status');
    if (statusIndex !== -1 && parts[statusIndex + 1]) {
      return parts[statusIndex + 1]!;
    }
    const match = tweetUrl.match(/status\/(\d+)/);
    return match ? match[1]! : null;
  } catch {
    return null;
  }
}

export function extractTwitterUsername(profileUrl: string): string | null {
  try {
    const url = new URL(profileUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

export default twitterAPI;
