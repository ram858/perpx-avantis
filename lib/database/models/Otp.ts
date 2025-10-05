export interface OtpModel {
  id: string
  phoneNumber: string
  code: string
  isVerified: boolean
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateOtpData {
  phoneNumber: string
  code: string
  expiresAt: Date
  isVerified?: boolean
}

export interface OtpFilters {
  phoneNumber?: string
  code?: string
  isVerified?: boolean
  expired?: boolean
}
