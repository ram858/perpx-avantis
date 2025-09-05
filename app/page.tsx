import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background gradient circles */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-80 h-80 rounded-full bg-gradient-to-br from-[#8759ff]/20 to-[#2c2146]/30 blur-xl"></div>
      </div>

      {/* Back arrow */}
      <div className="absolute top-12 left-6">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#ffffff]">
          <path
            d="M19 12H5M12 19L5 12L12 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-8">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <Image
            src="/trading-illustration.svg"
            alt="PrepX Trading Bot Illustration"
            width={256}
            height={256}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Welcome text */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#8759ff] to-[#A855F7] bg-clip-text text-transparent">
            Welcome to
          </h1>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#8759ff] to-[#A855F7] bg-clip-text text-transparent">
            PrepX
          </h1>
        </div>

        {/* Get Started button */}
        <div className="w-full max-w-sm pt-8">
          <Link href="/loading">
            <Button className="w-full bg-[#8759ff] hover:bg-[#7C3AED] text-white font-semibold py-4 rounded-2xl text-lg">
              Get Started →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
