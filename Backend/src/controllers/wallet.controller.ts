import { Response } from 'express';
import { Types } from 'mongoose';
import { User, Payment, LoyaltyTransaction } from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  MOCK_PURCHASE_POINTS_MIN,
  MOCK_PURCHASE_POINTS_MAX,
  MOCK_PURCHASE_POINTS_DEFAULT,
} from '../utils/constants';

const ETH_REGEX = /^0x[a-fA-F0-9]{40}$/;

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

function clampPoints(raw: number): number {
  return Math.max(
    MOCK_PURCHASE_POINTS_MIN,
    Math.min(MOCK_PURCHASE_POINTS_MAX, Math.round(raw))
  );
}

/**
 * POST /api/wallet/orders - Create a pending mock order (step 1).
 * Body: { walletAddress: string, amount?: number }
 * Returns orderId, pointsAmount, amountCrypto, txHash, status: 'pending'.
 */
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { walletAddress, amount: rawAmount } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({
        success: false,
        message: 'walletAddress is required. Connect your wallet (e.g. via RainbowKit) first.',
      });
      return;
    }

    const address = normalizeAddress(walletAddress);
    if (!ETH_REGEX.test(address)) {
      res.status(400).json({ success: false, message: 'Invalid wallet address' });
      return;
    }

    const pointsAmount =
      typeof rawAmount === 'number' && !Number.isNaN(rawAmount)
        ? clampPoints(rawAmount)
        : MOCK_PURCHASE_POINTS_DEFAULT;

    const mockTxHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
    const amountCrypto = (pointsAmount / 10_000).toFixed(6);

    const payment = await Payment.create({
      user: new Types.ObjectId(userId),
      pointsAmount,
      currency: 'ETH',
      amountCrypto,
      txHash: mockTxHash,
      status: 'pending',
      walletAddress: address,
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: payment._id,
        pointsAmount,
        amountCrypto,
        txHash: mockTxHash,
        status: 'pending',
        walletAddress: address,
      },
    });
  } catch (err) {
    console.error('createOrder error:', err);
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
};

/**
 * POST /api/wallet/orders/:orderId/confirm - Simulate confirmation: credit loyalty, save wallet to profile.
 */
export const confirmOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { orderId } = req.params;

    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      res.status(400).json({ success: false, message: 'Invalid order ID' });
      return;
    }

    const payment = await Payment.findById(orderId);
    if (!payment) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    if (payment.user.toString() !== userId) {
      res.status(403).json({ success: false, message: 'Not your order' });
      return;
    }
    if (payment.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Order already confirmed or failed' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    payment.status = 'completed';
    await payment.save();

    if (payment.walletAddress) {
      user.walletAddress = payment.walletAddress;
    }
    const previousBalance = user.loyaltyPoints;
    user.loyaltyPoints += payment.pointsAmount;
    await user.save();

    await LoyaltyTransaction.create({
      user: new Types.ObjectId(userId),
      type: 'purchase',
      amount: payment.pointsAmount,
      balanceAfter: user.loyaltyPoints,
      referenceType: 'Payment',
      referenceId: payment._id,
      metadata: { walletAddress: user.walletAddress },
    });

    res.status(200).json({
      success: true,
      data: {
        orderId: payment._id,
        txHash: payment.txHash,
        loyaltyPointsCredited: payment.pointsAmount,
        newBalance: user.loyaltyPoints,
        previousBalance,
      },
    });
  } catch (err) {
    console.error('confirmOrder error:', err);
    res.status(500).json({ success: false, message: 'Failed to confirm order' });
  }
};
