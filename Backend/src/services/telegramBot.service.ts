import axios from 'axios';

const TELEGRAM_API = 'https://api.telegram.org/bot';

function getToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

/**
 * Register the webhook URL with Telegram so updates are sent to our backend.
 * Call this once after your backend is publicly reachable (e.g. via ngrok).
 * Requires: TELEGRAM_BOT_TOKEN, PULSEBOT_WEBHOOK_BASE_URL (e.g. https://abc.ngrok.io)
 */
export async function registerWebhook(): Promise<{ ok: boolean; url?: string; error?: string }> {
  const token = getToken();
  const baseUrl = (process.env.PULSEBOT_WEBHOOK_BASE_URL ?? '').replace(/\/$/, '');
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };
  if (!baseUrl) return { ok: false, error: 'PULSEBOT_WEBHOOK_BASE_URL not set. Set it to your public URL (e.g. https://xxx.ngrok.io)' };
  const url = `${baseUrl}/api/pulsebot/webhook`;
  if (!url.startsWith('https://')) return { ok: false, error: 'Webhook URL must be HTTPS' };
  try {
    const { data } = await axios.get(`${TELEGRAM_API}${token}/setWebhook`, {
      params: { url },
      timeout: 10000,
    });
    const ok = !!data?.ok;
    if (!ok) return { ok: false, error: (data as { description?: string }).description ?? 'setWebhook failed' };
    return { ok: true, url };
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? (err.response?.data as { description?: string })?.description ?? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Send a text message to a Telegram chat. Returns true if sent, false if token missing or API error.
 */
export async function sendTelegramMessage(chatId: number | string, text: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    await axios.post(`${TELEGRAM_API}${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }, { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/** Shared message-like payload (message or channel_post). */
export interface TelegramMessageLike {
  message_id: number;
  from?: { id: number; username?: string; first_name?: string };
  chat: { id: number; type: string; title?: string };
  text?: string;
  date: number;
}

/** Telegram Update payload (minimal fields we use). */
export interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessageLike;
  channel_post?: TelegramMessageLike;
}

/**
 * Parse incoming webhook body as Telegram Update. Returns null if invalid.
 */
export function parseTelegramUpdate(body: unknown): TelegramUpdate | null {
  if (body && typeof body === 'object' && ('message' in body || 'channel_post' in body)) {
    return body as TelegramUpdate;
  }
  return null;
}

/**
 * Check if chat is a group (id < 0 for groups/supergroups).
 */
export function isGroupChat(chatId: number): boolean {
  return chatId < 0;
}
