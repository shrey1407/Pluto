/** Loyalty points required to create a new campaign. */
export const COST_CAMPAIGN_CREATE = 100;

/** Loyalty points required to add one quest to a campaign. */
export const COST_QUEST_ADD = 50;

/** Loyalty points awarded to the user when they complete (verify) any quest. */
export const QUEST_COMPLETION_REWARD_POINTS = 25;

/** Loyalty points awarded to the referrer when a new user signs up with their referral code. */
export const REFERRAL_REWARD_POINTS = 500;

/** Agora (mini social feed) */
export const MAX_POST_CONTENT_LENGTH = 500;
/** Max images per cast (stored as base64 data URLs, like profile picture). */
export const MAX_POST_IMAGES = 4;
export const MIN_TIP_AMOUNT = 1;
export const MAX_TIP_AMOUNT = 1_000_000;
export const AGORA_FEED_PAGE_SIZE = 50;
export const AGORA_REPLIES_PAGE_SIZE = 50;
export const AGORA_FOLLOW_PAGE_SIZE = 50;
export const AGORA_USERS_PAGE_SIZE = 100;
export const MAX_MESSAGE_CONTENT_LENGTH = 2000;
export const AGORA_MESSAGES_PAGE_SIZE = 50;
export const AGORA_NOTIFICATIONS_PAGE_SIZE = 20;
export const AGORA_MOST_TIPPED_PAGE_SIZE = 50;

/** ChainLens (wallet intelligence) - loyalty points per wallet lookup */
export const COST_CHAINLENS = 10;

/** TrendCraft - loyalty points per feature (feed, generate-content, content-suggestions) */
export const COST_TRENDCRAFT_GEMINI = 3;

/** PulseBot - link code expiry (minutes), loyalty cost for summary/ask/stats */
export const PULSEBOT_LINK_CODE_EXPIRY_MINUTES = 10;
export const COST_PULSEBOT_SUMMARY = 10;
export const COST_PULSEBOT_ASK = 10;
export const COST_PULSEBOT_STATS = 2;
export const PULSEBOT_SUMMARY_HOURS = 12;

/** Mock crypto purchase - loyalty points per "order" (RainbowKit wallet connect) */
export const MOCK_PURCHASE_POINTS_MIN = 10;
export const MOCK_PURCHASE_POINTS_MAX = 10_000;
export const MOCK_PURCHASE_POINTS_DEFAULT = 100;

/** Email integration (Gmail): sync, AI tasks, suggest reply, send – optional loyalty cost */
export const COST_EMAIL_SYNC = 0;
export const COST_EMAIL_TASKS = 5;
export const COST_EMAIL_SUGGEST_REPLY = 5;
export const EMAIL_SYNC_DAYS = 7;
export const EMAIL_SYNC_MAX_MESSAGES = 100;
