# Email Integration (Gmail) – Requirements & Cost

## Product vision

1. **Sync** – Automatically sync the user’s Gmail (inbox/recent threads).
2. **AI tasks** – AI analyzes synced emails and lists **tasks**: e.g. “Reply needed”, “Confirmation requested”, “Follow up”.
3. **User picks a task** – e.g. “HR asking for reimbursement confirmation – reply with positive acknowledgement”.
4. **Conversation** – User chats with the bot to refine the reply; bot suggests draft, user edits/confirms.
5. **Send** – After explicit user confirmation, the bot sends the reply (or creates a draft) via Gmail API.

Later: same pattern for **GitHub** (notifications, PRs, issues) and other providers.

---

## Functional requirements

### Gmail connection

- [ ] User can “Connect Gmail” from the app (OAuth 2.0 consent).
- [ ] Backend stores **refresh token** (encrypted or in env-secured DB) and optional email address.
- [ ] User can disconnect Gmail (revoke token / delete stored credentials).

### Sync

- [ ] Backend can **sync** recent emails (e.g. last N days or last M messages) for the connected account.
- [ ] Store minimal data: message id, thread id, from/to, subject, snippet, date, labelIds (so we can show “Inbox” vs “Sent”).
- [ ] Sync can be triggered: **on demand** (user clicks “Sync”) and optionally **periodic** (cron every X hours).
- [ ] Avoid duplicate storage: use Gmail `messageId` (or id) as unique key.

### AI task extraction

- [ ] Input: synced emails (or a subset, e.g. last 7 days, inbox only).
- [ ] Output: **list of tasks**, e.g.:
  - “Reply needed: HR asking for reimbursement confirmation – suggest positive acknowledgement.”
  - “Follow up: Project X proposal – no reply in 3 days.”
  - “Action: Approve request from manager@company.com.”
- [ ] Each task is tied to a **specific email/thread** (threadId, messageId) so we can “open” it and reply.

### User flow: select task → refine → send

- [ ] User sees a list of **tasks** (from AI); each task has a short title and optional summary.
- [ ] User selects one task → UI shows the **email thread** (subject, from, body/snippet) and a **chat** with the bot.
- [ ] Bot suggests a **reply draft** (or “no reply needed / mark as read”).
- [ ] User can **chat** to change tone, add/remove points, then **confirm**.
- [ ] On confirm: backend calls **Gmail API** to send the reply (or create draft). Only after explicit user confirmation.

### Security & compliance

- [ ] OAuth scopes limited to what’s needed: read (gmail.readonly or gmail.modify), send (gmail.send).
- [ ] Tokens stored securely; never log full tokens.
- [ ] **No send without user confirmation** in the UI (and optionally a second “Yes, send” step).

---

## Technical requirements

- **Backend**: Node/Express (existing). New routes under e.g. `/api/email-integration` or `/api/integrations/gmail`.
- **OAuth**: Server-side flow (redirect to Google → callback with `code` → exchange for access + refresh token). Use `google-auth-library` (already in use for login) or `axios` for token exchange.
- **Gmail API**: REST (e.g. `https://gmail.googleapis.com/gmail/v1/users/me/messages`) with OAuth access token. List messages, get message, send message.
- **DB**: New models, e.g. `GmailAccount` (userId, refreshToken, email, expiresAt), `SyncedEmail` (userId, gmailAccountId, messageId, threadId, from, to, subject, snippet, date, labelIds).
- **AI**: Use existing **Gemini** service for: (1) task extraction from email list, (2) reply draft suggestion from thread + user instructions.

---

## Is it free?

| Component            | Free? | Notes |
|---------------------|-------|--------|
| **Gmail API**       | Yes   | Quota: 1B quota units/day per project. Reading/sending emails uses units; normal usage is within free tier. |
| **Google OAuth**     | Yes   | No charge for OAuth consent or token exchange. |
| **Our backend/DB**   | Your cost | Hosting, DB, etc. |
| **Gemini (AI)**     | Tiered | Free tier has rate limits; beyond that, pay per use. Same as existing Trendcraft/PulseBot. |

**Summary:** The integration itself (Gmail + OAuth + our code) is **free**; the only potential cost is **AI usage** (Gemini) if you exceed the free tier. You can optionally **charge loyalty points** for “AI task extraction” or “suggest reply” to align with the rest of Pluto.

---

## Out of scope (for v1)

- Attachments (display only or “attach file” in reply later).
- Sending from a different “From” address (send as alias).
- GitHub / other providers (phase 2).

---

## Env variables needed

- `GOOGLE_CLIENT_ID` – already used for login (same or separate OAuth client).
- `GOOGLE_CLIENT_SECRET` – required for server-side OAuth (token exchange). Not needed for client-only Google sign-in.
- `BACKEND_PUBLIC_URL` or `PULSEBOT_WEBHOOK_BASE_URL` – public URL of the backend for OAuth redirect (e.g. `https://your-api.com`).
- `FRONTEND_ORIGIN` or `CORS_ORIGIN` – where to redirect after Gmail connect (e.g. `http://localhost:3000`).
- Redirect URI must be set in Google Cloud Console: `{BACKEND_PUBLIC_URL}/api/email-integration/gmail/callback`.
