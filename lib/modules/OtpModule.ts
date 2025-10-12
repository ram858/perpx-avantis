import { OtpService } from '../services/OTPService'

export class OtpModule {
  private static otpService: OtpService

  static getInstance(): OtpService {
    if (!this.otpService) {
      this.otpService = new OtpService()
    }
    return this.otpService
  }
}
