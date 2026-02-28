import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter: limits requests per IP per window.
 * Applied to all /api routes to protect against abuse.
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limiter for auth routes (register, login, Google).
 * Reduces brute-force and credential-stuffing risk.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
