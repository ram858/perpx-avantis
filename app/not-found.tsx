import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-[#8759ff] mb-4">404</h1>
        <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
        <p className="text-[#b4b4b4] mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/home">
          <Button className="bg-[#8759ff] hover:bg-[#7C3AED] text-white">Return to Home</Button>
        </Link>
      </div>
    </div>
  )
}
