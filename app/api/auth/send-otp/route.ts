import { NextRequest, NextResponse } from 'next/server'
import { OTPService } from '@/lib/services/OTPService'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Generate and store OTP using the service
    const otpService = new OTPService()
    const result = await otpService.sendOtp(phoneNumber)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      )
    }

    // In production, integrate with SMS service like Twilio, AWS SNS, etc.
    // For now, OTP is logged in the service
    
    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      // In development, include OTP in response
      ...(process.env.NODE_ENV === 'development' && result.otp && { otp: result.otp })
    })

  } catch (error) {
    console.error('Error sending OTP:', error)
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    )
  }
}

// Helper function to send SMS (implement with your preferred SMS service)
async function sendSMS(phoneNumber: string, message: string) {
  // Example with Twilio (uncomment and configure)
  /*
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const client = require('twilio')(accountSid, authToken)

  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phoneNumber
  })
  */

  // Example with AWS SNS (uncomment and configure)
  /*
  const AWS = require('aws-sdk')
  const sns = new AWS.SNS({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  })

  await sns.publish({
    Message: message,
    PhoneNumber: phoneNumber
  }).promise()
  */
}
