"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function LoadingPage() {
  const [progress, setProgress] = useState(0)
  const [loadingText, setLoadingText] = useState("Initializing PrepX...")
  const router = useRouter()

  useEffect(() => {
    const loadingSteps = [
      { text: "Initializing PrepX...", duration: 800 },
      { text: "Connecting to AI Trading Engine...", duration: 1200 },
      { text: "Loading Market Data...", duration: 1000 },
      { text: "Setting up Portfolio...", duration: 800 },
      { text: "Ready to Trade!", duration: 500 },
    ]

    let currentStep = 0
    let currentProgress = 0

    const updateProgress = () => {
      if (currentStep < loadingSteps.length) {
        const step = loadingSteps[currentStep]
        setLoadingText(step.text)

        const targetProgress = ((currentStep + 1) / loadingSteps.length) * 100
        const progressIncrement = (targetProgress - currentProgress) / (step.duration / 50)

        const progressInterval = setInterval(() => {
          currentProgress += progressIncrement
          setProgress(Math.min(currentProgress, targetProgress))

          if (currentProgress >= targetProgress) {
            clearInterval(progressInterval)
            currentStep++

            if (currentStep < loadingSteps.length) {
              setTimeout(updateProgress, 200)
            } else {
              // Navigate to home after loading completes
              setTimeout(() => {
                router.push("/home")
              }, 800)
            }
          }
        }, 50)
      }
    }

    updateProgress()
  }, [router])

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background gradient circles */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-80 h-80 rounded-full bg-gradient-to-br from-[#8759ff]/20 to-[#2c2146]/30 blur-xl animate-pulse"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-12 max-w-sm mx-auto">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="w-24 h-24 bg-[#4A2C7C] rounded-2xl flex items-center justify-center shadow-lg">
            <Image src="/trading-bot-icon.svg" alt="PrepX AI Bot" width={48} height={48} className="w-12 h-12" />
          </div>
          {/* Pulsing ring */}
          <div className="absolute inset-0 w-24 h-24 rounded-2xl border-2 border-[#8759ff]/30 animate-ping"></div>
        </div>

        {/* PrepX Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#8759ff] to-[#A855F7] bg-clip-text text-transparent">
            PrepX AI
          </h1>
          <p className="text-[#b4b4b4] text-sm">AI-Powered Trading Bot</p>
        </div>

        {/* Loading Progress */}
        <div className="w-full space-y-4">
          {/* Progress Bar */}
          <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8759ff] to-[#A855F7] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Progress Text */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#b4b4b4] animate-pulse">{loadingText}</span>
            <span className="text-[#8759ff] font-medium">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Loading Dots Animation */}
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-[#8759ff] rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-[#8759ff] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
          <div className="w-2 h-2 bg-[#8759ff] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
        </div>
      </div>
    </div>
  )
}
