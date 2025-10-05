"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Phone, Shield, CheckCircle } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"

interface LoginStepProps {
  onNext: (phoneNumber: string) => void
  onBack: () => void
}

interface OTPVerificationProps {
  phoneNumber: string
  onVerify: (otp: string) => void
  onBack: () => void
  onResend: () => void
}

function PhoneNumberStep({ onNext, onBack }: LoginStepProps) {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isValid, setIsValid] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const validatePhoneNumber = (phone: string) => {
    // Basic phone number validation (international format)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    return phoneRegex.test(phone.replace(/\s/g, ""))
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPhoneNumber(value)
    setIsValid(validatePhoneNumber(value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setIsLoading(true)

    try {
      // Send OTP to phone number
      const response = await fetch("/api/wallet/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      })

      if (response.ok) {
        const data = await response.json()
        onNext(phoneNumber)
        if (data.otp) {
          console.log(`OTP for ${phoneNumber}: ${data.otp}`)
        }
      } else {
        const error = await response.json()
        alert(error.message || "Failed to send OTP")
      }
    } catch (error) {
      console.error("Error sending OTP:", error)
      alert("Failed to send OTP. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-[#1a1a1a] border-[#333]">
      <CardHeader className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#8759ff] to-[#A855F7] flex items-center justify-center">
          <Phone className="w-8 h-8 text-white" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold text-white">Welcome to PrepX</CardTitle>
          <CardDescription className="text-[#b4b4b4] mt-2">
            Enter your phone number to get started
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-[#e5e5e5]">
              Phone Number
            </label>
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className="bg-[#2a2a2a] border-[#444] text-white placeholder:text-[#888] focus:border-[#8759ff] focus:ring-[#8759ff]/20"
                required
              />
              {isValid && (
                <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
            </div>
            <p className="text-xs text-[#888]">
              We'll send you a verification code via SMS
            </p>
          </div>

          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1 bg-transparent border-[#444] text-[#e5e5e5] hover:bg-[#333] hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isLoading}
              className="flex-1 bg-[#8759ff] hover:bg-[#7C3AED] text-white font-semibold disabled:opacity-50"
            >
              {isLoading ? "Sending..." : "Send Code"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function OTPVerificationStep({ phoneNumber, onVerify, onBack, onResend }: OTPVerificationProps) {
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [canResend, setCanResend] = useState(false)

  // Countdown timer
  useState(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true)
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  })

  const handleOTPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6)
    setOtp(value)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) return

    setIsLoading(true)

    try {
      // Call the parent's verification function directly instead of making duplicate API calls
      await onVerify(otp)
    } catch (error) {
      console.error("Error verifying OTP:", error)
      alert("Failed to verify OTP. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/wallet/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      })

      if (response.ok) {
        const data = await response.json()
        setTimeLeft(60)
        setCanResend(false)
        alert("New OTP sent successfully!")
        if (data.otp) {
          console.log(`New OTP for ${phoneNumber}: ${data.otp}`)
        }
      } else {
        const error = await response.json()
        alert(error.message || "Failed to resend OTP")
      }
    } catch (error) {
      console.error("Error resending OTP:", error)
      alert("Failed to resend OTP. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-[#1a1a1a] border-[#333]">
      <CardHeader className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#8759ff] to-[#A855F7] flex items-center justify-center">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold text-white">Verify Your Phone</CardTitle>
          <CardDescription className="text-[#b4b4b4] mt-2">
            Enter the 6-digit code sent to
            <br />
            <span className="text-[#8759ff] font-medium">{phoneNumber}</span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="otp" className="text-sm font-medium text-[#e5e5e5]">
              Verification Code
            </label>
            <Input
              id="otp"
              type="text"
              placeholder="123456"
              value={otp}
              onChange={handleOTPChange}
              className="bg-[#2a2a2a] border-[#444] text-white placeholder:text-[#888] focus:border-[#8759ff] focus:ring-[#8759ff]/20 text-center text-2xl tracking-widest"
              maxLength={6}
              required
            />
            <p className="text-xs text-[#888] text-center">
              {timeLeft > 0 ? `Resend code in ${timeLeft}s` : "Code expired"}
            </p>
          </div>

          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1 bg-transparent border-[#444] text-[#e5e5e5] hover:bg-[#333] hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={otp.length !== 6 || isLoading}
              className="flex-1 bg-[#8759ff] hover:bg-[#7C3AED] text-white font-semibold disabled:opacity-50"
            >
              {isLoading ? "Verifying..." : "Verify"}
            </Button>
          </div>

          {canResend && (
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={handleResend}
                disabled={isLoading}
                className="text-[#8759ff] hover:text-[#7C3AED] p-0"
              >
                Resend Code
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [currentStep, setCurrentStep] = useState<"phone" | "otp">("phone")
  const [phoneNumber, setPhoneNumber] = useState("")

  const handlePhoneSubmit = (phone: string) => {
    setPhoneNumber(phone)
    setCurrentStep("otp")
  }

  const handleOTPVerify = async (otp: string) => {
    try {
      const response = await fetch("/api/wallet/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber, otp }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Use the login function from AuthContext to properly set authentication
        login(data.data.accessToken, data.data.user)
        
        console.log('✅ Authentication successful, redirecting to home...')
        
        // Redirect to home
        router.push("/home")
      } else {
        const error = await response.json()
        alert(error.message || "Authentication failed. Please try again.")
      }
    } catch (error) {
      console.error("Authentication error:", error)
      alert("Authentication failed. Please try again.")
    }
  }

  const handleBack = () => {
    if (currentStep === "otp") {
      setCurrentStep("phone")
    } else {
      router.push("/")
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background gradient circles */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-80 h-80 rounded-full bg-gradient-to-br from-[#8759ff]/20 to-[#2c2146]/30 blur-xl animate-pulse"></div>
      </div>

      {/* Back button */}
      <div className="absolute top-12 left-6 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="text-[#ffffff] hover:bg-[#333] p-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full">
        {currentStep === "phone" ? (
          <PhoneNumberStep onNext={handlePhoneSubmit} onBack={handleBack} />
        ) : (
          <OTPVerificationStep
            phoneNumber={phoneNumber}
            onVerify={handleOTPVerify}
            onBack={handleBack}
            onResend={() => {
              // Resend logic is handled in the component
            }}
          />
        )}
      </div>
    </div>
  )
}
