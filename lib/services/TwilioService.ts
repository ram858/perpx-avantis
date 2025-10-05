import twilio from 'twilio'
import { getTwilioConfig } from './TwilioConfig'

export class TwilioService {
  private client: twilio.Twilio | null = null
  private fromNumber: string
  private isConfigured: boolean

  constructor() {
    const config = getTwilioConfig()
    this.fromNumber = config.phoneNumber
    this.isConfigured = config.isConfigured

    if (this.isConfigured) {
      try {
        this.client = twilio(config.accountSid, config.authToken)
        console.log('✅ Twilio configured successfully')
      } catch (error) {
        console.error('❌ Twilio configuration failed:', error)
        this.isConfigured = false
      }
    } else {
      console.log('⚠️  Twilio not configured - SMS will not be sent')
    }
  }

  async sendOTP(phoneNumber: string, otp: string): Promise<boolean> {
    if (!this.isConfigured || !this.client) {
      console.log(`📱 OTP for ${phoneNumber}: ${otp} (Twilio not configured)`)
      return false
    }

    try {
      const message = await this.client.messages.create({
        body: `Your PrepX verification code is: ${otp}. This code expires in 5 minutes.`,
        from: this.fromNumber,
        to: phoneNumber
      })

      console.log(`✅ OTP sent to ${phoneNumber}, SID: ${message.sid}`)
      return true
    } catch (error) {
      console.error('❌ Error sending OTP via Twilio:', error)
      console.log(`📱 Fallback OTP for ${phoneNumber}: ${otp}`)
      return false
    }
  }

  async sendWelcomeMessage(phoneNumber: string): Promise<boolean> {
    if (!this.isConfigured || !this.client) {
      console.log(`📱 Welcome message for ${phoneNumber} (Twilio not configured)`)
      return false
    }

    try {
      const message = await this.client.messages.create({
        body: 'Welcome to PrepX! Your account has been created successfully. Start trading with AI-powered insights.',
        from: this.fromNumber,
        to: phoneNumber
      })

      console.log(`✅ Welcome message sent to ${phoneNumber}, SID: ${message.sid}`)
      return true
    } catch (error) {
      console.error('❌ Error sending welcome message:', error)
      return false
    }
  }

  async sendTradingAlert(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.isConfigured || !this.client) {
      console.log(`📱 Trading alert for ${phoneNumber}: ${message} (Twilio not configured)`)
      return false
    }

    try {
      const smsMessage = await this.client.messages.create({
        body: `PrepX Trading Alert: ${message}`,
        from: this.fromNumber,
        to: phoneNumber
      })

      console.log(`✅ Trading alert sent to ${phoneNumber}, SID: ${smsMessage.sid}`)
      return true
    } catch (error) {
      console.error('❌ Error sending trading alert:', error)
      return false
    }
  }
}
