import { randomInt } from 'crypto'
import { DatabaseService } from './DatabaseService'
import { CreateOtpData } from '../database/models/Otp'

export class OtpService {
  private db = new DatabaseService()

  async generateOTP(): Promise<string> {
    return randomInt(100000, 999999).toString()
  }

  async sendOtp(phoneNumber: string): Promise<{ success: boolean; otp?: string; message: string }> {
    try {
      // Clean up any existing OTPs for this phone number
      await this.db.deleteOtpsByPhone(phoneNumber)

      // Generate new OTP
      const code = await this.generateOTP()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now

      // Store OTP in database
      const otpData: CreateOtpData = {
        phoneNumber,
        code,
        expiresAt,
        isVerified: false
      }

      await this.db.createOtp(otpData)

      // Log OTP to console for development
      console.log(`📱 OTP for ${phoneNumber}: ${code}`)
      console.log(`⏰ Expires at: ${expiresAt.toISOString()}`)

      return {
        success: true,
        otp: code, // Include in response for development
        message: 'OTP sent successfully'
      }

    } catch (error) {
      console.error('Error sending OTP:', error)
      return {
        success: false,
        message: 'Failed to send OTP'
      }
    }
  }

  async verifyOtp(phoneNumber: string, code: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find the OTP record
      const otp = await this.db.findOtp({ phoneNumber, code })

      if (!otp) {
        // Check if there's any OTP for this phone number to give better feedback
        const anyOtp = await this.db.findOtp({ phoneNumber })
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

      console.log(`✅ OTP verified for ${phoneNumber}`)

      return {
        success: true,
        message: 'OTP verified successfully'
      }

    } catch (error) {
      console.error('Error verifying OTP:', error)
      return {
        success: false,
        message: 'Failed to verify OTP. Please try again.'
      }
    }
  }

  async markOtpAsVerified(phoneNumber: string, code: string): Promise<void> {
    try {
      const otp = await this.db.findOtp({ phoneNumber, code })
      if (otp && !otp.isVerified) {
        await this.db.updateOtp(otp.id, { isVerified: true })
        console.log(`✅ OTP marked as verified for ${phoneNumber}`)
      }
    } catch (error) {
      console.error('Error marking OTP as verified:', error)
    }
  }

  async cleanupExpiredOtps(): Promise<void> {
    try {
      // This would require a more complex query, for now we'll skip it
      // In production, you might want to run this as a scheduled job
      console.log('🧹 OTP cleanup skipped (implement as needed)')
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error)
    }
  }
}

// Legacy compatibility - keep the old class name for existing code
export class OTPService extends OtpService {}
