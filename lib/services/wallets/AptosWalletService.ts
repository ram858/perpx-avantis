import * as bip39 from 'bip39'
import { AptosAccount, AptosAccountObject } from '@aptos-labs/ts-sdk'
import { derivePath } from 'ed25519-hd-key'
import { IGenericWalletService, WalletInfo } from './IGenericWalletService'

// You need to install: npm install @aptos-labs/ts-sdk bip39 ed25519-hd-key

export class AptosWalletService implements IGenericWalletService {
  getChainName(): string {
    return 'aptos'
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
      const derivedSeed = derivePath("m/44'/637'/0'/0'/0'", seed.toString('hex')).key
      const account = new AptosAccount(derivedSeed)

      return {
        address: account.accountAddress.toString(),
        privateKey: account.toPrivateKeyObject().privateKeyHex,
        publicKey: account.publicKey.toString(),
        mnemonic: mnemonicPhrase
      }
    } catch (error) {
      console.error('Error generating Aptos wallet:', error)
      throw new Error('Failed to generate Aptos wallet')
    }
  }

  async deriveWallet(mnemonic: string, derivationPath: string = "m/44'/637'/0'/0'/0'"): Promise<WalletInfo> {
    try {
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase')
      }

      const seed = await bip39.mnemonicToSeed(mnemonic)
      const derivedSeed = derivePath(derivationPath, seed.toString('hex')).key
      const account = new AptosAccount(derivedSeed)

      return {
        address: account.accountAddress.toString(),
        privateKey: account.toPrivateKeyObject().privateKeyHex,
        publicKey: account.publicKey.toString(),
        mnemonic
      }
    } catch (error) {
      console.error('Error deriving Aptos wallet:', error)
      throw new Error('Failed to derive Aptos wallet')
    }
  }

  validateAddress(address: string): boolean {
    try {
      // Aptos address validation (hex string, 64 characters)
      const hexRegex = /^[0-9a-fA-F]{64}$/
      return hexRegex.test(address)
    } catch {
      return false
    }
  }
}
