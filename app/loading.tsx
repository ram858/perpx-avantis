import { LoadingSpinner } from "@/components/loading-spinner"

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <p className="text-[#b4b4b4]">Loading PrepX...</p>
      </div>
    </div>
  )
}
