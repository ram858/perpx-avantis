import React from 'react'

interface LoadingSkeletonProps {
  className?: string
  lines?: number
}

export function LoadingSkeleton({ className = '', lines = 1 }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 bg-gray-700 rounded mb-2"
          style={{
            width: `${Math.random() * 40 + 60}%`,
            animationDelay: `${index * 0.1}s`
          }}
        />
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-[#1a1a1a] border-[#262626] p-6 rounded-2xl animate-pulse">
      <div className="space-y-4">
        <div className="h-6 bg-gray-700 rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-700 rounded w-5/6"></div>
          <div className="h-4 bg-gray-700 rounded w-4/6"></div>
        </div>
      </div>
    </div>
  )
}

export function BalanceSkeleton() {
  return (
    <div className="bg-[#1a1a1a] border-[#262626] p-6 rounded-2xl animate-pulse">
      <div className="space-y-4">
        <div className="h-4 bg-gray-700 rounded w-1/3"></div>
        <div className="h-12 bg-gray-700 rounded w-2/3"></div>
        <div className="flex space-x-4">
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/6"></div>
        </div>
      </div>
    </div>
  )
}
