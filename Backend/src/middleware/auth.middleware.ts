import { Request, Response, NextFunction } from 'express';
import { User } from '../models';
import { Types } from 'mongoose';
import { verifyToken } from '../utils/auth.utils';

export interface AuthUser {
  id: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser & { _id: Types.ObjectId; isAdmin?: boolean };
}

/**
 * Require authentication via JWT.
 * Expects: Authorization: Bearer <token>
 * Sets req.user = { id: userId, _id } after verifying token and loading user.
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const allowXUserId = process.env.NODE_ENV !== 'production';
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : allowXUserId && (req.headers['x-user-id'] as string | undefined)
          ? null
          : undefined;

    if (!token && !(allowXUserId && req.headers['x-user-id'])) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (token) {
      try {
        const payload = verifyToken(token);
        const userId = payload.userId;
        if (!userId || !Types.ObjectId.isValid(userId)) {
          res.status(401).json({ success: false, message: 'Invalid token' });
          return;
        }
        const user = await User.findById(userId);
        if (!user) {
          res.status(401).json({ success: false, message: 'User not found' });
          return;
        }
        req.user = { id: userId, _id: user._id, isAdmin: user.isAdmin === true };
        next();
        return;
      } catch {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
        return;
      }
    }

    if (!allowXUserId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const userId = req.headers['x-user-id'] as string;
    if (!Types.ObjectId.isValid(userId)) {
      res.status(401).json({ success: false, message: 'Invalid user id' });
      return;
    }
    const user = await User.findById(userId);
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }
    req.user = { id: userId, _id: user._id, isAdmin: user.isAdmin === true };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Require admin. Use after requireAuth. Returns 403 if user is not admin.
 */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return;
  }
  next();
};

/**
 * Optional auth: sets req.user if valid JWT or x-user-id present; does not 401 if missing.
 * Use for routes that return different data when authenticated (e.g. "liked" on posts).
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (token) {
      try {
        const payload = verifyToken(token);
        const userId = payload.userId;
        if (userId && Types.ObjectId.isValid(userId)) {
          const user = await User.findById(userId);
          if (user) req.user = { id: userId, _id: user._id, isAdmin: user.isAdmin === true };
        }
      } catch {
        // ignore invalid token
      }
    } else if (process.env.NODE_ENV !== 'production') {
      const userId = req.headers['x-user-id'] as string | undefined;
      if (userId && Types.ObjectId.isValid(userId)) {
        const user = await User.findById(userId);
        if (user) req.user = { id: userId, _id: user._id, isAdmin: user.isAdmin === true };
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};
