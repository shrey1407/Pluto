import { User } from '../models';
import { generateReferralCode } from './auth.utils';

/**
 * Generate a unique referral code by checking against existing users.
 */
export async function getUniqueReferralCode(): Promise<string> {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateReferralCode();
    const existing = await User.findOne({ referralCode: code });
    if (!existing) return code;
  }
  throw new Error('Could not generate unique referral code');
}
