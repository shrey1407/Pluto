import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, sepolia } from 'wagmi/chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID'

export const config = getDefaultConfig({
  appName: 'Pluto',
  projectId,
  chains: [mainnet, sepolia],
  ssr: false,
})
