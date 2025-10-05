import { OtpService } from '../services/OtpService'

export class OtpModule {
  private static otpService: OtpService

  static getInstance(): OtpService {
    if (!this.otpService) {
      this.otpService = new OtpService()
    }
    return this.otpService
  }
}
