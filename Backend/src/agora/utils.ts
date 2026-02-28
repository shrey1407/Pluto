import { MAX_POST_CONTENT_LENGTH } from '../utils/constants';

export function sanitizeContent(content: string): string {
  return content.trim().slice(0, MAX_POST_CONTENT_LENGTH);
}
