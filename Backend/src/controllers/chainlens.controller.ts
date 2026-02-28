import { Response } from 'express';
import { Types } from 'mongoose';
import axios from 'axios';
import { User, LoyaltyTransaction } from '../models';
import { AuthRequest } from '../middleware/auth.middleware';
import { COST_CHAINLENS } from '../utils/constants';
import { cacheGet, cacheSet, CACHE_TTL } from '../utils/redis.cache';
import {
  getWalletTokens,
  getWalletTransactions,
  getWalletTokenTransfers,
  getNativeBalance,
  getWalletNFTs,
  type MoralisChain,
  type TokenBalanceWithPrice,
  type NativeTransaction,
  type Erc20Transfer,
  type WalletNFTItem,
} from '../services/moralis.service';

const CHAINLENS_CACHE_TTL = CACHE_TTL.CHAINLENS_HOURS * 60 * 60;

const ETH_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SUPPORTED_CHAINS: MoralisChain[] = [
  'eth',
  'polygon',
  'bsc',
  'avalanche',
  'arbitrum',
  'optimism',
  'base',
];

export type DegenLabel = 'Paper Hands' | 'Diamond Hands' | 'DeFi Scientist';

function computeDegenScore(
  txCount: number,
  uniqueTokenCount: number
): { label: DegenLabel; description: string } {
  const activity = txCount * 2 + uniqueTokenCount * 3;
  if (activity >= 40 || (txCount >= 30 && uniqueTokenCount >= 5)) {
    return {
      label: 'DeFi Scientist',
      description: 'High transaction frequency and diverse portfolio. You know your way around the chain.',
    };
  }
  if (activity <= 10 || (txCount <= 5 && uniqueTokenCount <= 2)) {
    return {
      label: 'Paper Hands',
      description: 'Low activity and few holdings. HODL or diversify to level up.',
    };
  }
  return {
    label: 'Diamond Hands',
    description: 'Steady activity and balanced portfolio. You hold through the volatility.',
  };
}

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

/**
 * POST /api/chainlens - Get wallet intelligence (costs 1 loyalty point).
 * Body: { walletAddress: string, chain?: string }
 */
export const getWalletInsights = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { walletAddress, chain: chainParam } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({ success: false, message: 'walletAddress is required' });
      return;
    }

    const address = normalizeAddress(walletAddress);
    if (!ETH_REGEX.test(address)) {
      res.status(400).json({ success: false, message: 'Invalid wallet address' });
      return;
    }

    const chain: MoralisChain = SUPPORTED_CHAINS.includes(chainParam)
      ? chainParam
      : 'eth';

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.loyaltyPoints < COST_CHAINLENS) {
      res.status(400).json({
        success: false,
        message: `Insufficient loyalty points. Required: ${COST_CHAINLENS}, available: ${user.loyaltyPoints}`,
      });
      return;
    }

    const cacheKey = `chainlens:${address}:${chain}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached) as Record<string, unknown>;
        data.loyaltyPointsSpent = 0;
        data.yourNewBalance = user.loyaltyPoints;
        res.json({ success: true, data });
        return;
      } catch {
        // invalid cache, fall through to fetch
      }
    }

    const [tokensRes, nativeTxRes, erc20TransfersRes, nativeBalanceRes, nftsRes] = await Promise.all([
      getWalletTokens(address, chain, 100, true),
      getWalletTransactions(address, chain, 50, 'DESC'),
      getWalletTokenTransfers(address, chain, 50, 'DESC'),
      getNativeBalance(address, chain),
      getWalletNFTs(address, chain, 24, true),
    ]);

    const tokens = (tokensRes.result ?? []) as TokenBalanceWithPrice[];
    const nativeTxs = (nativeTxRes.result ?? []) as NativeTransaction[];
    const erc20Transfers = (erc20TransfersRes.result ?? []) as Erc20Transfer[];
    const nativeBalanceWei = nativeBalanceRes.balance ?? '0';
    const nftItems = (nftsRes.result ?? []) as WalletNFTItem[];

    const usdValues = tokens.map((t) => (t.usd_value != null ? Number(t.usd_value) : 0));
    const netWorthUSD = usdValues.reduce((sum, v) => sum + v, 0);

    const tokensWithValue = tokens
      .filter((t) => (t.usd_value != null ? Number(t.usd_value) : 0) > 0)
      .sort((a, b) => (Number(b.usd_value) ?? 0) - (Number(a.usd_value) ?? 0));

    // Native balance formatted (wei -> human, 6 decimals)
    const nativeBalanceFormatted = (() => {
      try {
        const wei = BigInt(nativeBalanceWei);
        const div = BigInt(1e18);
        const whole = wei / div;
        const frac = (wei % div) * BigInt(1e6) / div;
        return `${whole}.${frac.toString().padStart(6, '0').slice(0, 6)}`;
      } catch {
        return '0';
      }
    })();

    // Portfolio allocation for charts (top 10 by value)
    const portfolioAllocation = tokensWithValue.slice(0, 10).map((t) => ({
      name: (t.symbol ?? 'UNKNOWN').slice(0, 12),
      symbol: t.symbol ?? 'UNKNOWN',
      value: Math.round((Number(t.usd_value) ?? 0) * 100) / 100,
      percentage: netWorthUSD > 0
        ? Math.round(((Number(t.usd_value) ?? 0) / netWorthUSD) * 10000) / 100
        : 0,
    }));

    // Activity by day (last 30 days): count of native + erc20 txs per day
    const dayCounts = new Map<string, number>();
    const addDay = (iso: string) => {
      const day = iso.slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    };
    nativeTxs.forEach((tx) => addDay(tx.block_timestamp));
    erc20Transfers.forEach((tx) => addDay(tx.block_timestamp));
    const sortedDays = [...dayCounts.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
    const activityByDay = sortedDays.map(([date, count]) => ({ date, count }));

    const topHoldings = tokensWithValue.slice(0, 5).map((t) => ({
      symbol: t.symbol ?? 'UNKNOWN',
      name: t.name ?? '',
      balance: t.balance_formatted ?? t.balance ?? '0',
      valueUSD: Number(t.usd_value) ?? 0,
      percentage: netWorthUSD > 0
        ? Math.round(((Number(t.usd_value) ?? 0) / netWorthUSD) * 10000) / 100
        : 0,
      logo: t.logo ?? undefined,
    }));

    type TimelineItem = {
      type: 'Send' | 'Receive' | 'Buy' | 'Sell';
      token?: string;
      amount?: string;
      value?: string;
      date: string;
      txHash: string;
      from?: string;
      to?: string;
    };

    const timeline: TimelineItem[] = [];

    for (const tx of nativeTxs.slice(0, 5)) {
      const isOutgoing = normalizeAddress(tx.from_address) === address;
      timeline.push({
        type: isOutgoing ? 'Send' : 'Receive',
        token: 'ETH',
        amount: tx.value,
        date: tx.block_timestamp,
        txHash: tx.hash,
        from: tx.from_address,
        to: tx.to_address,
      });
    }

    for (const tx of erc20Transfers.slice(0, 10)) {
      const isOutgoing = normalizeAddress(tx.from_address) === address;
      const symbol = tx.token_symbol ?? 'ERC20';
      timeline.push({
        type: isOutgoing ? 'Sell' : 'Buy',
        token: symbol,
        amount: tx.value,
        date: tx.block_timestamp,
        txHash: tx.transaction_hash,
        from: tx.from_address,
        to: tx.to_address,
      });
    }

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const transactionTimeline = timeline.slice(0, 10);

    // NFTs: name, collection, image, floor price
    const nfts = nftItems.map((nft) => {
      let image: string | undefined;
      if (nft.normalized_metadata?.image) {
        image = typeof nft.normalized_metadata.image === 'string' ? nft.normalized_metadata.image : undefined;
      }
      if (!image && nft.media?.original_media_url) image = nft.media.original_media_url;
      if (!image && nft.media?.media_collection?.high?.url) image = nft.media.media_collection.high.url;
      if (!image && nft.media?.media_collection?.medium?.url) image = nft.media.media_collection.medium.url;
      if (!image && nft.media?.media_collection?.low?.url) image = nft.media.media_collection.low.url;
      const name = nft.normalized_metadata?.name ?? nft.name ?? `#${nft.token_id}`;
      const floorUsd = nft.floor_price_usd != null ? parseFloat(String(nft.floor_price_usd)) : undefined;
      return {
        tokenAddress: nft.token_address,
        tokenId: nft.token_id,
        name,
        collection: nft.symbol ?? nft.name ?? 'NFT',
        image: image ?? undefined,
        floorPriceUsd: floorUsd != null && !Number.isNaN(floorUsd) ? Math.round(floorUsd * 100) / 100 : undefined,
        contractType: nft.contract_type ?? 'ERC721',
      };
    });

    const totalTxCount = nativeTxs.length + erc20Transfers.length;
    const uniqueTokens = new Set(tokens.map((t) => t.token_address)).size;
    const degenScore = computeDegenScore(totalTxCount, uniqueTokens);

    const newBalance = user.loyaltyPoints - COST_CHAINLENS;
    await User.findByIdAndUpdate(userId, { loyaltyPoints: newBalance });
    await LoyaltyTransaction.create({
      user: new Types.ObjectId(userId),
      type: 'feature_use',
      amount: -COST_CHAINLENS,
      balanceAfter: newBalance,
      referenceType: 'Feature',
      metadata: { feature: 'ChainLens', walletAddress: address, chain },
    });

    const data = {
      walletAddress: address,
      chain,
      portfolio: {
        netWorthUSD: Math.round(netWorthUSD * 100) / 100,
        tokenCount: tokens.length,
        nativeBalance: nativeBalanceFormatted,
      },
      degenScore: {
        label: degenScore.label,
        description: degenScore.description,
        txCount: totalTxCount,
        uniqueTokenCount: uniqueTokens,
      },
      topHoldings,
      portfolioAllocation,
      activityByDay,
      nfts,
      transactionTimeline,
      loyaltyPointsSpent: COST_CHAINLENS,
      yourNewBalance: newBalance,
    };
    await cacheSet(cacheKey, JSON.stringify(data), CHAINLENS_CACHE_TTL);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ChainLens failed';
    if (message.includes('MORALIS_API_KEY')) {
      res.status(503).json({ success: false, message: 'Wallet data service is not configured' });
      return;
    }
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      res.status(503).json({ success: false, message: 'Invalid Moralis API key' });
      return;
    }
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      res.status(429).json({ success: false, message: 'Rate limit exceeded. Try again later.' });
      return;
    }
    res.status(500).json({ success: false, message });
  }
};
