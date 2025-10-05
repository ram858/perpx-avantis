export interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
  isConfigured: boolean
}

export function getTwilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER

  return {
    accountSid: accountSid || '',
    authToken: authToken || '',
    phoneNumber: phoneNumber || '',
    isConfigured: !!(accountSid && authToken && phoneNumber)
  }
}

export function isTwilioConfigured(): boolean {
  return getTwilioConfig().isConfigured
}
