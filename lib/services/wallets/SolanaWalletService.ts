import * as bip39 from 'bip39'
import { Keypair } from '@solana/web3.js'
import { derivePath } from 'ed25519-hd-key'
import { IGenericWalletService, WalletInfo } from './IGenericWalletService'

// You need to install: npm install @solana/web3.js bip39 ed25519-hd-key

export class SolanaWalletService implements IGenericWalletService {
  getChainName(): string {
    return 'solana'
  }

  async generateWallet(mnemonic?: string): Promise<WalletInfo> {
    try {
      let mnemonicPhrase: string

      if (mnemonic) {
        if (!bip39.validateMnemonic(mnemonic)) {
          throw new Error('Invalid mnemonic phrase')
        }
        mnemonicPhrase = mnemonic
      } else {
        mnemonicPhrase = bip39.generateMnemonic()
      }

      const seed = await bip39.mnemonicToSeed(mnemonicPhrase)
      const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key
      const keypair = Keypair.fromSeed(derivedSeed)

      return {
        address: keypair.publicKey.toString(),
        privateKey: Buffer.from(keypair.secretKey).toString('hex'),
        publicKey: keypair.publicKey.toString(),
        mnemonic: mnemonicPhrase
      }
    } catch (error) {
      console.error('Error generating Solana wallet:', error)
      throw new Error('Failed to generate Solana wallet')
    }
  }

  async deriveWallet(mnemonic: string, derivationPath: string = "m/44'/501'/0'/0'"): Promise<WalletInfo> {
    try {
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase')
      }

      const seed = await bip39.mnemonicToSeed(mnemonic)
      const derivedSeed = derivePath(derivationPath, seed.toString('hex')).key
      const keypair = Keypair.fromSeed(derivedSeed)

      return {
        address: keypair.publicKey.toString(),
        privateKey: Buffer.from(keypair.secretKey).toString('hex'),
        publicKey: keypair.publicKey.toString(),
        mnemonic
      }
    } catch (error) {
      console.error('Error deriving Solana wallet:', error)
      throw new Error('Failed to derive Solana wallet')
    }
  }

  validateAddress(address: string): boolean {
    try {
      // Basic Solana address validation (base58, 32-44 characters)
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
      return base58Regex.test(address)
    } catch {
      return false
    }
  }
}
