import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** Scopes needed for read + send. */
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

function getOAuth2Client(): OAuth2Client | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return new OAuth2Client(clientId, clientSecret);
}

/**
 * Build the URL to send the user to for Gmail OAuth consent.
 * redirectUri must match the one registered in Google Cloud Console.
 */
export function getGmailAuthUrl(redirectUri: string, state?: string): string | null {
  const client = getOAuth2Client();
  if (!client) return null;
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    redirect_uri: redirectUri,
    state: state ?? undefined,
  });
  return url;
}

/**
 * Exchange authorization code for tokens. Returns { accessToken, refreshToken, email } or null.
 */
export async function exchangeGmailCode(
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string; email: string } | null> {
  const client = getOAuth2Client();
  if (!client) return null;
  try {
    const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) return null;

    client.setCredentials(tokens);
    const email = await fetchProfileEmail(client);
    return { refreshToken, email: email ?? '' };
  } catch {
    return null;
  }
}

async function fetchProfileEmail(client: OAuth2Client): Promise<string | null> {
  try {
    const accessToken = (await client.getAccessToken()).token;
    if (!accessToken) return null;
    const { data } = await axios.get<{ emailAddress?: string }>(
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 5000 }
    );
    return data?.emailAddress ?? null;
  } catch {
    return null;
  }
}

/**
 * Get a valid access token from a refresh token. Uses in-memory client.
 */
async function getAccessToken(refreshToken: string): Promise<string | null> {
  const client = getOAuth2Client();
  if (!client) return null;
  client.setCredentials({ refresh_token: refreshToken });
  try {
    const { token } = await client.getAccessToken();
    return token ?? null;
  } catch {
    return null;
  }
}

export interface GmailMessageListItem {
  id: string;
  threadId: string;
  labelIds?: string[];
}

/**
 * List recent messages (id and threadId only). Use list with maxResults and optional q.
 */
export async function listGmailMessages(
  refreshToken: string,
  options: { maxResults?: number; q?: string; labelIds?: string[] } = {}
): Promise<GmailMessageListItem[]> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return [];

  const params: Record<string, string | number> = {
    maxResults: options.maxResults ?? 50,
  };
  if (options.q) params.q = options.q;

  try {
    const { data } = await axios.get<{ messages?: { id: string; threadId: string; labelIds?: string[] }[] }>(
      `${GMAIL_API}/messages`,
      {
        params,
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );
    return (data.messages ?? []).map((m) => ({
      id: m.id,
      threadId: m.threadId,
      labelIds: m.labelIds,
    }));
  } catch {
    return [];
  }
}

const GMAIL_THREADS_API = `${GMAIL_API}/threads`;

/** Profile (messagesTotal, threadsTotal). */
export async function getGmailProfile(
  refreshToken: string
): Promise<{ messagesTotal: number; threadsTotal: number } | null> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return null;
  try {
    const { data } = await axios.get<{ messagesTotal?: number; threadsTotal?: number }>(
      `${GMAIL_API}/profile`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 5000 }
    );
    return {
      messagesTotal: data.messagesTotal ?? 0,
      threadsTotal: data.threadsTotal ?? 0,
    };
  } catch {
    return null;
  }
}

/** Unread count (capped at 500). */
export async function getGmailUnreadCount(refreshToken: string): Promise<number> {
  const list = await listGmailMessages(refreshToken, { maxResults: 500, q: 'is:unread' });
  return list.length;
}

/** List thread ids (recent first). */
export async function listGmailThreadIds(
  refreshToken: string,
  options: { maxResults?: number } = {}
): Promise<{ id: string }[]> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return [];
  try {
    const { data } = await axios.get<{ threads?: { id: string }[] }>(GMAIL_THREADS_API, {
      params: { maxResults: options.maxResults ?? 20 },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });
    return (data.threads ?? []).map((t) => ({ id: t.id }));
  } catch {
    return [];
  }
}

/** Get thread with message count and first message id (for subject). */
export async function getGmailThread(
  refreshToken: string,
  threadId: string
): Promise<{ id: string; messageCount: number; firstMessageId?: string } | null> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return null;
  try {
    const { data } = await axios.get<{ id: string; messages?: { id: string }[] }>(
      `${GMAIL_THREADS_API}/${threadId}`,
      {
        params: { format: 'minimal' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      }
    );
    const messages = data.messages ?? [];
    const first = messages[0];
    return {
      id: data.id,
      messageCount: messages.length,
      firstMessageId: first?.id,
    };
  } catch {
    return null;
  }
}

/** Get message metadata only (subject, from, internalDate) for digest. */
export async function getGmailMessageMetadata(
  refreshToken: string,
  messageId: string
): Promise<{ subject: string; from: string; internalDate?: string } | null> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return null;
  try {
    const { data } = await axios.get<GmailMessageFull>(`${GMAIL_API}/messages/${messageId}`, {
      params: { format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 8000,
    });
    const payload = data.payload;
    const subject = getHeader(payload, 'Subject');
    const from = getHeader(payload, 'From');
    return { subject, from, internalDate: data.internalDate };
  } catch {
    return null;
  }
}

/** Latest message timestamp (last activity). */
export async function getGmailLatestActivityTimestamp(refreshToken: string): Promise<Date | null> {
  const list = await listGmailMessages(refreshToken, { maxResults: 1 });
  if (list.length === 0) return null;
  const meta = await getGmailMessageMetadata(refreshToken, list[0].id);
  if (!meta?.internalDate) return null;
  const ms = parseInt(meta.internalDate, 10);
  return Number.isNaN(ms) ? null : new Date(ms);
}

export interface GmailMessagePart {
  mimeType: string;
  body?: { data?: string; size?: number };
  filename?: string;
}

export interface GmailMessagePayload {
  headers?: { name: string; value: string }[];
  parts?: GmailMessagePart[];
  body?: { data?: string };
  mimeType?: string;
}

export interface GmailMessageFull {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate?: string;
  payload?: GmailMessagePayload;
}

function getHeader(payload: GmailMessagePayload | undefined, name: string): string {
  const h = payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function extractBody(payload: GmailMessagePayload | undefined): { plain?: string; html?: string } {
  if (!payload) return {};
  const parts = payload.parts ?? [];
  let plain: string | undefined;
  let html: string | undefined;
  for (const p of parts) {
    if (p.body?.data) {
      const decoded = decodeBase64Url(p.body.data);
      if (p.mimeType === 'text/plain') plain = decoded;
      else if (p.mimeType === 'text/html') html = decoded;
    }
  }
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') html = decoded;
    else plain = decoded;
  }
  return { plain, html };
}

/**
 * Get a single message by id. Returns parsed fields + body.
 */
export async function getGmailMessage(
  refreshToken: string,
  messageId: string
): Promise<{
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: Date;
  labelIds: string[];
  bodyPlain?: string;
  bodyHtml?: string;
} | null> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return null;

  try {
    const { data } = await axios.get<GmailMessageFull>(`${GMAIL_API}/messages/${messageId}`, {
      params: { format: 'full' },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });

    const payload = data.payload;
    const from = getHeader(payload, 'From');
    const to = getHeader(payload, 'To');
    const subject = getHeader(payload, 'Subject');
    const dateStr = getHeader(payload, 'Date');
    const date = dateStr ? new Date(dateStr) : new Date(0);
    const { plain: bodyPlain, html: bodyHtml } = extractBody(payload);

    return {
      id: data.id,
      threadId: data.threadId,
      from,
      to,
      subject,
      snippet: data.snippet ?? '',
      date,
      labelIds: data.labelIds ?? [],
      bodyPlain,
      bodyHtml,
    };
  } catch {
    return null;
  }
}

/**
 * Send a reply (or new message) in a thread. Uses Gmail API users.messages.send with RFC 2822 format.
 * threadId and references can be set for threading; subject can start with "Re:" for reply.
 */
export async function sendGmailMessage(
  refreshToken: string,
  options: {
    to: string;
    subject: string;
    bodyPlain: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string;
  }
): Promise<{ id: string } | null> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) return null;

  const lines = [
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    options.bodyPlain.replace(/\r?\n/g, '\r\n'),
  ];
  const raw = Buffer.from(lines.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  try {
    const body: { raw: string; threadId?: string } = { raw };
    if (options.threadId) body.threadId = options.threadId;

    const { data } = await axios.post<{ id: string }>(`${GMAIL_API}/messages/send`, body, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    return { id: data.id };
  } catch {
    return null;
  }
}
