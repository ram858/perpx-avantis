import { ethers } from 'ethers'
import { IGenericWalletService, WalletInfo } from './IGenericWalletService'

export class EthereumWalletService implements IGenericWalletService {
  getChainName(): string {
    return 'ethereum'
  }

  async generateWallet(mnemonic?: string): Promise<WalletInfo> {
    try {
      let wallet: ethers.Wallet

      if (mnemonic) {
        wallet = ethers.Wallet.fromPhrase(mnemonic)
      } else {
        wallet = ethers.Wallet.createRandom()
      }

      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        mnemonic: wallet.mnemonic?.phrase
      }
    } catch (error) {
      console.error('Error generating Ethereum wallet:', error)
      throw new Error('Failed to generate Ethereum wallet')
    }
  }

  async deriveWallet(mnemonic: string, derivationPath: string = "m/44'/60'/0'/0/0"): Promise<WalletInfo> {
    try {
      const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic)
      const wallet = hdNode.derivePath(derivationPath)

      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        mnemonic
      }
    } catch (error) {
      console.error('Error deriving Ethereum wallet:', error)
      throw new Error('Failed to derive Ethereum wallet')
    }
  }

  validateAddress(address: string): boolean {
    try {
      return ethers.isAddress(address)
    } catch {
      return false
    }
  }
}
