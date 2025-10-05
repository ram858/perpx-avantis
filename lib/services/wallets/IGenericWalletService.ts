export interface WalletInfo {
  address: string
  privateKey: string
  publicKey?: string
  mnemonic?: string
}

export interface IGenericWalletService {
  generateWallet(mnemonic?: string): Promise<WalletInfo>
  deriveWallet(mnemonic: string, derivationPath?: string): Promise<WalletInfo>
  validateAddress(address: string): boolean
  getChainName(): string
}
