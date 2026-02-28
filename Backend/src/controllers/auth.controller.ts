import { Request, Response } from 'express';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import {
  User,
  Follow,
  QuestCompletion,
  Campaign,
  Post,
  LoyaltyTransaction,
  type IUser,
} from '../models';
import { REFERRAL_REWARD_POINTS } from '../utils/constants';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  hashPassword,
  comparePassword,
  signToken,
  generateReferralCode,
} from '../utils/auth.utils';
import twitterAPI, { extractTwitterUsername } from '../utils/twitterApi';

const MIN_PASSWORD_LENGTH = 8;

/** Parse twitter241 RapidAPI user response: result.data.user.result.rest_id */
function getRestIdFromRapidUserResponse(r: Record<string, unknown>): string | null {
  const result = r?.result as { data?: { user?: { result?: { rest_id?: string } } } } | undefined;
  const restId = result?.data?.user?.result?.rest_id;
  return restId ? String(restId) : null;
}

/** Return user object without passwordHash for API responses; includes id for frontend. */
function toSafeUser(user: IUser) {
  const u = user.toObject ? user.toObject() : { ...user } as Record<string, unknown>;
  delete u.passwordHash;
  u.id = String(u._id ?? user._id);
  return u;
}

/** POST /api/auth/register - Email/password signup */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username, referralCode: referralCodeFromBody } = req.body as {
      email?: string;
      password?: string;
      username?: string;
      referralCode?: string;
    };

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const referrer =
      typeof referralCodeFromBody === 'string' && referralCodeFromBody.trim()
        ? await User.findOne({ referralCode: referralCodeFromBody.trim() })
        : null;

    const passwordHash = await hashPassword(password);
    const referralCode = generateReferralCode();
    const user = await User.create({
      email: normalizedEmail,
      emailVerified: false,
      passwordHash,
      username: typeof username === 'string' ? username.trim() || undefined : undefined,
      referralCode,
      ...(referrer ? { referredBy: referrer._id } : {}),
    });

    if (referrer) {
      const alreadyCredited = await LoyaltyTransaction.findOne({
        type: 'referral',
        user: referrer._id,
        referenceId: user._id,
      });
      if (!alreadyCredited) {
        const referrerCurrent = await User.findById(referrer._id).select('loyaltyPoints').lean();
        const newBalance = (referrerCurrent?.loyaltyPoints ?? 0) + REFERRAL_REWARD_POINTS;
        await User.findByIdAndUpdate(referrer._id, {
          $inc: { loyaltyPoints: REFERRAL_REWARD_POINTS },
        });
        await LoyaltyTransaction.create({
          user: referrer._id,
          type: 'referral',
          amount: REFERRAL_REWARD_POINTS,
          balanceAfter: newBalance,
          referenceType: 'User',
          referenceId: user._id,
        });
      }
    }

    const token = signToken({ userId: String(user._id), email: user.email ?? '' });
    res.status(201).json({ success: true, data: { token, user: toSafeUser(user) } });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

/** POST /api/auth/login - Email/password login */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.passwordHash) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const token = signToken({ userId: String(user._id), email: user.email ?? '' });
    res.json({ success: true, data: { token, user: toSafeUser(user) } });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

/** POST /api/auth/google - Google OAuth (idToken from client) */
export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, referralCode: referralCodeFromBody } = req.body as {
      idToken?: string;
      referralCode?: string;
    };
    if (typeof idToken !== 'string') {
      res.status(400).json({ success: false, message: 'idToken is required' });
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      res.status(500).json({ success: false, message: 'Google auth not configured' });
      return;
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      res.status(400).json({ success: false, message: 'Invalid Google token' });
      return;
    }

    const email = payload.email;
    const googleId = payload.sub;

    let user = await User.findOne({ googleId });
    if (!user) user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      const referrer =
        typeof referralCodeFromBody === 'string' && referralCodeFromBody.trim()
          ? await User.findOne({ referralCode: referralCodeFromBody.trim() })
          : null;
      const referralCode = generateReferralCode();
      user = await User.create({
        email: email.toLowerCase(),
        emailVerified: true,
        googleId,
        referralCode,
        ...(referrer ? { referredBy: referrer._id } : {}),
      });
      if (referrer) {
        const alreadyCredited = await LoyaltyTransaction.findOne({
          type: 'referral',
          user: referrer._id,
          referenceId: user._id,
        });
        if (!alreadyCredited) {
          const referrerCurrent = await User.findById(referrer._id).select('loyaltyPoints').lean();
          const newBalance = (referrerCurrent?.loyaltyPoints ?? 0) + REFERRAL_REWARD_POINTS;
          await User.findByIdAndUpdate(referrer._id, {
            $inc: { loyaltyPoints: REFERRAL_REWARD_POINTS },
          });
          await LoyaltyTransaction.create({
            user: referrer._id,
            type: 'referral',
            amount: REFERRAL_REWARD_POINTS,
            balanceAfter: newBalance,
            referenceType: 'User',
            referenceId: user._id,
          });
        }
      }
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.emailVerified = true;
      await user.save();
    }

    const token = signToken({ userId: String(user._id), email: user.email ?? '' });
    res.json({ success: true, data: { token, user: toSafeUser(user) } });
  } catch (err) {
    console.error('googleAuth error', err);
    res.status(500).json({ success: false, message: 'Google sign-in failed' });
  }
};

/** GET /api/auth/me - Current user with profile stats (requires auth) */
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const [followersCount, followingCount, questsCompleted, campaignsCreated, postsCount, campaignsParticipated] =
      await Promise.all([
        Follow.countDocuments({ following: user._id }),
        Follow.countDocuments({ follower: user._id }),
        QuestCompletion.countDocuments({ user: user._id }),
        Campaign.countDocuments({ owner: user._id }),
        Post.countDocuments({ user: user._id }),
        QuestCompletion.distinct('campaign', { user: user._id }).then((ids) => ids.length),
      ]);

    const profile = {
      followersCount,
      followingCount,
      questsCompleted,
      campaignsParticipated,
      campaignsCreated,
      postsCount,
    };

    res.json({
      success: true,
      data: { user: toSafeUser(user), profile },
    });
  } catch (err) {
    console.error('getMe error', err);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
};

/** PATCH /api/auth/me - Update profile (username, profilePicture, twitterProfileUrl) */
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { username, profilePicture, twitterProfileUrl } = req.body as {
      username?: string;
      profilePicture?: string;
      twitterProfileUrl?: string;
    };

    const updates: Record<string, unknown> = {};
    if (typeof username === 'string') updates.username = username.trim() || undefined;
    if (typeof profilePicture === 'string') updates.profilePicture = profilePicture;

    if (typeof twitterProfileUrl === 'string' && twitterProfileUrl.trim()) {
      const raw = twitterProfileUrl.trim();
      const twitterUsername = raw.includes('/') || raw.startsWith('http')
        ? extractTwitterUsername(raw)
        : raw.replace(/^@/, '');
      if (!twitterUsername) {
        res.status(400).json({ success: false, message: 'Invalid Twitter profile URL. Use e.g. https://x.com/yourhandle or your handle' });
        return;
      }
      const bearerToken = process.env.TWITTER_BEARER_TOKEN?.trim();
      const rapidKey = process.env.RAPIDAPI_KEY?.trim();
      const hasTwitterApi = bearerToken && bearerToken !== 'undefined' && bearerToken.length >= 20;
      if (!hasTwitterApi && !rapidKey) {
        res.status(503).json({
          success: false,
          message: 'Set TWITTER_BEARER_TOKEN or RAPIDAPI_KEY in .env. Twitter needs credits; use RAPIDAPI_KEY with twitter241 for linking without Twitter credits.',
        });
        return;
      }
      let resolvedId: string | null = null;

      if (hasTwitterApi) {
        try {
          const resp = await twitterAPI.get(`/users/by/username/${encodeURIComponent(twitterUsername)}`);
          const data = resp.data as { data?: { id: string; username: string } };
          if (data?.data?.id) resolvedId = data.data.id;
        } catch (apiErr: unknown) {
        const ax = apiErr as { response?: { status?: number; data?: { detail?: string; errors?: Array<{ message?: string }> } }; message?: string };
        const status = ax?.response?.status;
        const body = ax?.response?.data;
        const bodyStr = typeof body === 'string' ? body : (body?.detail ? String(body.detail) : '');
        const creditsError = bodyStr.includes('credits') || bodyStr.includes('enrolled account');
        console.error('Twitter API error (link)', { status, username: twitterUsername, body: body ?? ax?.message });

        if (!resolvedId && process.env.RAPIDAPI_KEY?.trim()) {
          try {
            const rapidResp = await axios.get('https://twitter241.p.rapidapi.com/user', {
              params: { username: twitterUsername },
              headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                'x-rapidapi-host': 'twitter241.p.rapidapi.com',
              },
            });
            const r = rapidResp.data as Record<string, unknown>;
            const restId = getRestIdFromRapidUserResponse(r);
            if (restId && String(restId).match(/^\d+$/)) resolvedId = String(restId);
          } catch (rapidErr) {
            console.error('RapidAPI user lookup (link) failed', { username: twitterUsername, err: rapidErr });
          }
        }

        if (!resolvedId) {
          let msg: string;
          if (status === 401) {
            msg = 'Twitter rejected the Bearer token (401). In .env use the Bearer Token from Twitter Developer Portal → your App → Keys and tokens → Bearer Token (long string, not API Key/Secret). Restart the backend after changing .env.';
          } else if (creditsError || status === 403) {
            msg =
              'Twitter API requires a paid plan (no credits). We tried RapidAPI as fallback—ensure RAPIDAPI_KEY is set in .env and the twitter241 "user" endpoint is available. Alternatively add credits in Twitter Developer Portal.';
          } else if (status === 404) {
            msg = 'That Twitter/X username was not found.';
          } else if (status === 429) {
            msg = 'Too many requests to Twitter. Try again in a few minutes.';
          } else if (body && typeof body === 'object' && (body as { errors?: Array<{ message?: string }> }).errors?.[0]?.message) {
            msg = (body as { errors: Array<{ message?: string }> }).errors[0].message ?? 'Twitter API error.';
          } else if (typeof (body as { detail?: string })?.detail === 'string') {
            msg = (body as { detail: string }).detail;
          } else {
            msg = 'Could not verify Twitter/X account. Try again later. Check server logs if it persists.';
          }
          res.status(400).json({ success: false, message: msg });
          return;
        }
        }
      }

      if (!resolvedId && rapidKey) {
        try {
          const rapidResp = await axios.get('https://twitter241.p.rapidapi.com/user', {
            params: { username: twitterUsername },
            headers: {
              'x-rapidapi-key': rapidKey,
              'x-rapidapi-host': 'twitter241.p.rapidapi.com',
            },
          });
          const r = rapidResp.data as Record<string, unknown>;
          const restId = getRestIdFromRapidUserResponse(r);
          if (restId && String(restId).match(/^\d+$/)) resolvedId = String(restId);
        } catch (rapidErr) {
          console.error('RapidAPI user lookup (link) failed', { username: twitterUsername, err: rapidErr });
        }
      }

      if (resolvedId) updates.twitterId = resolvedId;
      else if (!resolvedId) {
        res.status(400).json({
          success: false,
          message: 'Could not resolve Twitter/X user. Twitter API may need credits; ensure RAPIDAPI_KEY is set and twitter241 "user" endpoint is available.',
        });
        return;
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: { user: toSafeUser(user) } });
  } catch (err) {
    console.error('updateProfile error', err);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};
