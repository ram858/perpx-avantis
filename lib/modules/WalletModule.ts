import { WalletService } from '../services/WalletService'
import { EncryptionService } from '../services/EncryptionService'
import { TwilioService } from '../services/TwilioService'

export class WalletModule {
  public readonly walletService: WalletService
  public readonly encryptionService: EncryptionService
  public readonly twilioService: TwilioService

  constructor() {
    this.walletService = new WalletService()
    this.encryptionService = new EncryptionService()
    this.twilioService = new TwilioService()
  }

  // Wallet creation and management
  async createOrGetWallet(phoneNumber: string, chain: string, mnemonic?: string) {
    return this.walletService.createOrGetWallet({
      phoneNumber,
      chain,
      mnemonic
    })
  }

  async getWalletsByPhone(phoneNumber: string) {
    return this.walletService.getWalletsByPhone(phoneNumber)
  }

  async getWalletByPhoneAndChain(phoneNumber: string, chain: string) {
    return this.walletService.getWalletByPhoneAndChain(phoneNumber, chain)
  }

  async getWalletPrivateKey(walletId: string, phoneNumber: string) {
    return this.walletService.getWalletPrivateKey(walletId, phoneNumber)
  }

  // Encryption services
  encryptPrivateKey(privateKey: string) {
    return this.encryptionService.encrypt(privateKey)
  }

  decryptPrivateKey(encryptedKey: string, iv: string) {
    return this.encryptionService.decrypt(encryptedKey, iv)
  }

  // Twilio services
  async sendOTP(phoneNumber: string, otp: string) {
    return this.twilioService.sendOTP(phoneNumber, otp)
  }

  async sendWelcomeMessage(phoneNumber: string) {
    return this.twilioService.sendWelcomeMessage(phoneNumber)
  }

  async sendTradingAlert(phoneNumber: string, message: string) {
    return this.twilioService.sendTradingAlert(phoneNumber, message)
  }

  // Utility methods
  getSupportedChains() {
    return this.walletService.getSupportedChains()
  }

  async validateWalletAddress(chain: string, address: string) {
    return this.walletService.validateWalletAddress(chain, address)
  }
}

// Export singleton instance
export const walletModule = new WalletModule()
