import { randomInt } from 'crypto'
import Twilio from 'twilio'
import { config } from 'dotenv'
import { DatabaseService } from './DatabaseService'
import { CreateOtpData } from '../database/models/Otp'

// Load environment variables
config({ path: '.env.local' })

export class OtpService {
  private db = new DatabaseService()
  private client: Twilio.Twilio | null = null
  private verifyServiceSid: string | null = null
  private isNodeEnvDevelopment: boolean

  constructor() {
    // Force production mode if Twilio credentials are available
    const hasTwilioCredentials = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID
    this.isNodeEnvDevelopment = process.env.NODE_ENV === 'development' && !hasTwilioCredentials

    // Only initialize Twilio client if not in development mode
    if (!this.isNodeEnvDevelopment) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      this.verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || null

      // Validate required Twilio configuration
      if (!accountSid || !authToken || !this.verifyServiceSid) {
        console.warn(
          'Missing required Twilio configuration. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID environment variables.'
        )
        console.warn('Falling back to development mode (fake OTP generation)')
        this.isNodeEnvDevelopment = true
      } else {
        this.client = Twilio(accountSid, authToken)
        console.log('✅ Twilio client initialized for production SMS')
      }
    } else {
      console.log('🔧 Running in development mode - using fake OTP generation')
    }
  }

  private generateOTP(): string {
    return randomInt(100000, 999999).toString()
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new Error('Invalid phone number provided')
    }

    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '')
    
    // If it doesn't start with +, add appropriate country code
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('977')) {
        // Nepal number with country code
        cleaned = '+' + cleaned
      } else if (cleaned.length === 10 && cleaned.startsWith('98')) {
        // Nepal number without country code
        cleaned = '+977' + cleaned
      } else if (cleaned.length === 10) {
        // US number without country code
        cleaned = '+1' + cleaned
      } else {
        // Default to US if we can't determine
        cleaned = '+1' + cleaned
      }
    }
    
    // Validate the final format
    if (!cleaned.match(/^\+[1-9]\d{1,14}$/)) {
      throw new Error(`Invalid phone number format: ${phoneNumber} -> ${cleaned}`)
    }
    
    return cleaned
  }

  private async cleanupExpiredOtps(): Promise<void> {
    try {
      // This would require a more complex query, for now we'll skip it
      // In production, you might want to run this as a scheduled job
      console.log('🧹 OTP cleanup skipped (implement as needed)')
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error)
    }
  }

  async sendOtp(phoneNumber: string): Promise<{ success: boolean; otp?: string; message: string; phoneNumber?: string }> {
    try {
      // Clean up expired OTPs first
      await this.cleanupExpiredOtps()

      // Normalize phone number to E.164 format
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber)
      console.log('Original phone:', phoneNumber, 'Normalized:', normalizedPhone)

      if (this.isNodeEnvDevelopment) {
        // Clean up any existing OTPs for this phone number
        await this.db.deleteOtpsByPhone(normalizedPhone)

        // Generate a random 6-digit OTP
        const code = this.generateOTP()
        
        // Create OTP record with 5 minutes expiry
        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + 5)

        const otpData: CreateOtpData = {
          phoneNumber: normalizedPhone,
          code,
          expiresAt,
          isVerified: false
        }

        await this.db.createOtp(otpData)

        console.log(`📱 OTP for ${normalizedPhone}: ${code}`)
        console.log(`⏰ Expires at: ${expiresAt.toISOString()}`)

        return {
          success: true,
          message: `OTP sent successfully. This is development phase. No SMS will be sent. Use the OTP: ${code}`,
          phoneNumber: normalizedPhone,
          otp: code, // Include OTP in response for development
        }
      }

      // Production mode - use Twilio
      if (!this.client || !this.verifyServiceSid) {
        throw new Error('Twilio client not properly initialized. Please check your Twilio configuration.')
      }

      try {
        console.log('Sending Twilio verification to:', normalizedPhone)
        
        // First validate the phone number
        let lookup
        try {
          lookup = await this.client.lookups.v1.phoneNumbers(normalizedPhone).fetch()
          console.log('Phone lookup successful:', lookup.phoneNumber)
        } catch (lookupError) {
          console.error('Phone lookup failed:', lookupError)
          throw new Error(`Invalid phone number format: ${lookupError}`)
        }

        // Send verification SMS
        const verification = await this.client.verify.v2
          .services(this.verifyServiceSid)
          .verifications.create({
            to: normalizedPhone,
            channel: 'sms',
            appHash: 'X3LC6N5n5RB', // Optional: for Android SMS verification
          })

        console.log('Twilio verification created:', verification.sid)

        return {
          success: true,
          message: 'OTP sent successfully to number ' + normalizedPhone,
          phoneNumber: normalizedPhone,
        }
      } catch (error) {
        console.error('Twilio OTP sending failed:', error)
        throw new Error(`Failed to send OTP: ${error}`)
      }

    } catch (error) {
      console.error('Error sending OTP:', error)
      return {
        success: false,
        message: `Failed to send OTP: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  async verifyOtp(phoneNumber: string, code: string): Promise<{ success: boolean; message: string; phoneNumber?: string }> {
    try {
      // Clean up expired OTPs first
      await this.cleanupExpiredOtps()

      // Normalize phone number to E.164 format
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber)
      console.log('Verifying OTP for:', normalizedPhone)

      if (this.isNodeEnvDevelopment) {
        // Find the most recent unused OTP for this phone number
        const otp = await this.db.findOtp({ phoneNumber: normalizedPhone, code })

        if (!otp) {
          // Check if there's any OTP for this phone number to give better feedback
          const anyOtp = await this.db.findOtp({ phoneNumber: normalizedPhone })
          if (anyOtp) {
            return {
              success: false,
              message: 'Invalid OTP code. Please enter the correct 6-digit code.'
            }
          } else {
            return {
              success: false,
              message: 'No OTP found for this phone number. Please request a new OTP.'
            }
          }
        }

        if (new Date() > otp.expiresAt) {
          // Clean up expired OTP
          await this.db.deleteOtp(otp.id)
          return {
            success: false,
            message: 'OTP has expired. Please request a new OTP.'
          }
        }

        if (otp.isVerified) {
          return {
            success: false,
            message: 'OTP has already been used. Please request a new OTP.'
          }
        }

        // Don't mark as verified yet - let the calling code handle this after successful authentication
        // This prevents the "already used" issue when users refresh the page

        console.log(`✅ OTP verified for ${normalizedPhone}`)

        return {
          success: true,
          message: 'OTP verified successfully',
          phoneNumber: normalizedPhone
        }
      }

      // Production mode - use Twilio
      if (!this.client || !this.verifyServiceSid) {
        throw new Error('Twilio client not properly initialized. Please check your Twilio configuration.')
      }

      try {
        console.log('Verifying Twilio OTP for:', normalizedPhone)
        
        const verificationCheck = await this.client.verify.v2
          .services(this.verifyServiceSid)
          .verificationChecks.create({
            to: normalizedPhone,
            code,
          })

        console.log('Verification check result:', verificationCheck.status)

        if (verificationCheck.status !== 'approved') {
          return {
            success: false,
            message: 'OTP verification failed',
          }
        }

        return {
          success: true,
          message: 'OTP verified successfully',
          phoneNumber: normalizedPhone,
        }
      } catch (error) {
        console.error('Twilio OTP verification failed:', error)
        throw new Error(`Failed to verify OTP: ${error}`)
      }

    } catch (error) {
      console.error('Error verifying OTP:', error)
      return {
        success: false,
        message: `Failed to verify OTP: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  async markOtpAsVerified(phoneNumber: string, code: string): Promise<void> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber)
      const otp = await this.db.findOtp({ phoneNumber: normalizedPhone, code })
      if (otp && !otp.isVerified) {
        await this.db.updateOtp(otp.id, { isVerified: true })
        console.log(`✅ OTP marked as verified for ${normalizedPhone}`)
      }
    } catch (error) {
      console.error('Error marking OTP as verified:', error)
    }
  }

}

// Legacy compatibility - keep the old class name for existing code
export class OTPService extends OtpService {}
