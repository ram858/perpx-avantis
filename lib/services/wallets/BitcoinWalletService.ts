import * as bip39 from 'bip39'
import * as bitcoin from 'bitcoinjs-lib'
import { BIP32Factory } from 'bip32'
import * as ecc from 'tiny-secp256k1'
import { IGenericWalletService, WalletInfo } from './IGenericWalletService'

// You need to install: npm install bip39 bitcoinjs-lib bip32 tiny-secp256k1
const bip32 = BIP32Factory(ecc)

export class BitcoinWalletService implements IGenericWalletService {
  private readonly network = bitcoin.networks.bitcoin // Use testnet for development

  getChainName(): string {
    return 'bitcoin'
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
      const root = bip32.fromSeed(seed, this.network)
      
      // Derive first address: m/44'/0'/0'/0/0
      const path = "m/44'/0'/0'/0/0"
      const child = root.derivePath(path)
      
      if (!child.privateKey) {
        throw new Error('Failed to derive private key')
      }

      const { address } = bitcoin.payments.p2pkh({
        pubkey: child.publicKey,
        network: this.network
      })

      if (!address) {
        throw new Error('Failed to generate address')
      }

      return {
        address,
        privateKey: child.privateKey.toString('hex'),
        publicKey: child.publicKey.toString('hex'),
        mnemonic: mnemonicPhrase
      }
    } catch (error) {
      console.error('Error generating Bitcoin wallet:', error)
      throw new Error('Failed to generate Bitcoin wallet')
    }
  }

  async deriveWallet(mnemonic: string, derivationPath: string = "m/44'/0'/0'/0/0"): Promise<WalletInfo> {
    try {
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase')
      }

      const seed = await bip39.mnemonicToSeed(mnemonic)
      const root = bip32.fromSeed(seed, this.network)
      const child = root.derivePath(derivationPath)
      
      if (!child.privateKey) {
        throw new Error('Failed to derive private key')
      }

      const { address } = bitcoin.payments.p2pkh({
        pubkey: child.publicKey,
        network: this.network
      })

      if (!address) {
        throw new Error('Failed to generate address')
      }

      return {
        address,
        privateKey: child.privateKey.toString('hex'),
        publicKey: child.publicKey.toString('hex'),
        mnemonic
      }
    } catch (error) {
      console.error('Error deriving Bitcoin wallet:', error)
      throw new Error('Failed to derive Bitcoin wallet')
    }
  }

  validateAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.network)
      return true
    } catch {
      return false
    }
  }
}
