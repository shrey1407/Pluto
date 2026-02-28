import axios, { AxiosInstance } from 'axios';

const MORALIS_BASE = 'https://deep-index.moralis.io/api/v2.2';

function getClient(): AxiosInstance {
  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) {
    throw new Error('MORALIS_API_KEY is not set');
  }
  return axios.create({
    baseURL: MORALIS_BASE,
    headers: {
      Accept: 'application/json',
      'X-API-Key': apiKey,
    },
  });
}

export type MoralisChain =
  | 'eth'
  | 'polygon'
  | 'bsc'
  | 'avalanche'
  | 'arbitrum'
  | 'optimism'
  | 'base';

export interface TokenBalanceWithPrice {
  token_address: string;
  name: string;
  symbol: string;
  logo?: string;
  decimals: string;
  balance: string;
  balance_formatted?: string;
  usd_price?: number;
  usd_value?: number;
  portfolio_percentage?: number;
  native_token?: boolean;
  possible_spam?: boolean;
}

export interface WalletTokensResponse {
  result?: TokenBalanceWithPrice[];
  page?: string;
  page_size?: string;
  cursor?: string;
}

/**
 * Get native + ERC20 token balances with USD prices for a wallet.
 * GET /wallets/:address/tokens
 */
export async function getWalletTokens(
  address: string,
  chain: MoralisChain = 'eth',
  limit = 100,
  excludeSpam = true
): Promise<WalletTokensResponse> {
  const client = getClient();
  const { data } = await client.get<WalletTokensResponse>(
    `/wallets/${address}/tokens`,
    {
      params: {
        chain,
        limit,
        exclude_spam: excludeSpam,
      },
    }
  );
  return data;
}

export interface NativeTransaction {
  hash: string;
  from_address: string;
  to_address: string;
  value: string;
  block_timestamp: string;
  block_number: number;
  receipt_status?: string;
  transaction_fee?: string;
}

export interface WalletTransactionsResponse {
  result?: NativeTransaction[];
  cursor?: string;
  page?: string;
  page_size?: string;
}

/**
 * Get native (ETH) transactions for a wallet.
 * GET /:address
 */
export async function getWalletTransactions(
  address: string,
  chain: MoralisChain = 'eth',
  limit = 10,
  order: 'ASC' | 'DESC' = 'DESC'
): Promise<WalletTransactionsResponse> {
  const client = getClient();
  const { data } = await client.get<WalletTransactionsResponse>(
    `/${address}`,
    {
      params: { chain, limit, order },
    }
  );
  return data;
}

export interface Erc20Transfer {
  transaction_hash: string;
  address: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  to_address: string;
  from_address: string;
  value: string;
  token_decimals?: string;
  token_name?: string;
  token_symbol?: string;
}

export interface WalletTokenTransfersResponse {
  result?: Erc20Transfer[];
  cursor?: string;
  page?: string;
  page_size?: string;
}

/**
 * Get ERC20 token transfers for a wallet.
 * GET /:address/erc20/transfers
 */
export async function getWalletTokenTransfers(
  address: string,
  chain: MoralisChain = 'eth',
  limit = 20,
  order: 'ASC' | 'DESC' = 'DESC'
): Promise<WalletTokenTransfersResponse> {
  const client = getClient();
  const { data } = await client.get<WalletTokenTransfersResponse>(
    `/${address}/erc20/transfers`,
    {
      params: { chain, limit, order },
    }
  );
  return data;
}

export interface NativeBalanceResponse {
  balance: string;
}

/**
 * Get native token balance (e.g. ETH) for a wallet.
 * GET /:address/balance
 */
export async function getNativeBalance(
  address: string,
  chain: MoralisChain = 'eth'
): Promise<NativeBalanceResponse> {
  const client = getClient();
  const { data } = await client.get<NativeBalanceResponse>(
    `/${address}/balance`,
    { params: { chain } }
  );
  return data;
}

export interface WalletNFTItem {
  token_address: string;
  token_id: string;
  contract_type?: string;
  owner_of?: string;
  name?: string;
  symbol?: string;
  token_uri?: string;
  metadata?: string;
  normalized_metadata?: {
    name?: string;
    description?: string;
    image?: string;
    animation_url?: string;
  };
  amount?: string;
  possible_spam?: string;
  floor_price?: string;
  floor_price_usd?: string;
  floor_price_currency?: string;
  last_sale?: {
    transaction_hash?: string;
    price?: string;
    price_formatted?: string;
    usd_price_at_sale?: string;
    current_usd_value?: string;
  };
  media?: { original_media_url?: string; media_collection?: { low?: { url?: string }; medium?: { url?: string }; high?: { url?: string } } };
}

export interface WalletNFTsResponse {
  status?: string;
  page?: string;
  page_size?: string;
  cursor?: string;
  result?: WalletNFTItem[];
}

/**
 * Get NFTs held by a wallet.
 * GET /:address/nft
 */
export async function getWalletNFTs(
  address: string,
  chain: MoralisChain = 'eth',
  limit = 24,
  excludeSpam = true
): Promise<WalletNFTsResponse> {
  const client = getClient();
  const { data } = await client.get<WalletNFTsResponse>(
    `/${address}/nft`,
    {
      params: {
        chain,
        limit,
        format: 'decimal',
        exclude_spam: excludeSpam,
        normalize_metadata: true,
        media_items: true,
      },
    }
  );
  return data;
}
