"use client"
import { Card } from "@/components/ui/card"
import type React from "react"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import Link from "next/link"

export default function ChatPage() {
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [tradingPhase, setTradingPhase] = useState<"initial" | "active" | "closing" | "completed" | "conversation">(
    "conversation",
  )
  const [closingPositions, setClosingPositions] = useState<string[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [terminalPosition, setTerminalPosition] = useState({ right: 16, bottom: 80 }) // Default: right: 16px, bottom: 80px
  const [messages, setMessages] = useState([
    { type: "user", content: "I want to make $30 profit by investing $50", timestamp: "9:41 AM" },
    {
      type: "bot",
      content:
        'Trade Already Exists - You Are Only Allowed To Run One Perp Prompt (Ex, I Want To Make $10 By Investing $100" At A Time. Please Wait For The Positions To Hit Profit Goal or Closed Or Liquidated To Run Another Prompt.',
      timestamp: "9:42 AM",
    },
  ])
  const [showTyping, setShowTyping] = useState(false)
  const [hasDragged, setHasDragged] = useState(false)
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 })

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      const newMessage = {
        type: "user" as const,
        content: inputValue.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages((prev) => [...prev, newMessage])
      setInputValue("")

      setShowTyping(true)
      setTimeout(() => {
        setShowTyping(false)
      }, 2000)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendMessage()
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }

  const handleClosePosition = (positionId: string) => {
    setClosingPositions((prev) => [...prev, positionId])
    setTimeout(() => {
      setClosingPositions((prev) => prev.filter((id) => id !== positionId))
      setTradingPhase("completed")
    }, 2000)
  }

  const toggleTerminal = () => {
    setIsTerminalExpanded(!isTerminalExpanded)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStartPosition({ x: e.clientX, y: e.clientY })
    setHasDragged(false)
    setIsDragging(true)
    const rect = (e.target as HTMLElement).closest(".terminal-widget")?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setDragStartPosition({ x: touch.clientX, y: touch.clientY })
    setHasDragged(false)
    setIsDragging(true)
    const rect = (e.target as HTMLElement).closest(".terminal-widget")?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      })
    }
  }

  const handleTerminalClick = () => {
    if (!hasDragged) {
      toggleTerminal()
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const moveDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartPosition.x, 2) + Math.pow(e.clientY - dragStartPosition.y, 2),
      )

      if (moveDistance > 5) {
        // 5px threshold
        setHasDragged(true)
      }

      const widgetWidth = 200
      const widgetHeight = 120
      const newRight = Math.max(
        0,
        Math.min(window.innerWidth - widgetWidth, window.innerWidth - (e.clientX + (widgetWidth - dragOffset.x))),
      )
      const newBottom = Math.max(
        0,
        Math.min(window.innerHeight - widgetHeight, window.innerHeight - (e.clientY - dragOffset.y)),
      )

      setTerminalPosition({ right: newRight, bottom: newBottom })
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return
      e.preventDefault()

      const touch = e.touches[0]
      const moveDistance = Math.sqrt(
        Math.pow(touch.clientX - dragStartPosition.x, 2) + Math.pow(touch.clientY - dragStartPosition.y, 2),
      )

      if (moveDistance > 5) {
        // 5px threshold
        setHasDragged(true)
      }

      const widgetWidth = 200
      const widgetHeight = 120
      const newRight = Math.max(
        0,
        Math.min(window.innerWidth - widgetWidth, window.innerWidth - (touch.clientX + (widgetWidth - dragOffset.x))),
      )
      const newBottom = Math.max(
        0,
        Math.min(window.innerHeight - widgetHeight, window.innerHeight - (touch.clientY - dragOffset.y)),
      )

      setTerminalPosition({ right: newRight, bottom: newBottom })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleTouchEnd)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging, dragOffset, dragStartPosition])

  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages((prev) => [...prev, { type: "user", content: "What is BOME", timestamp: "9:45 AM" }])
      setShowTyping(true)

      setTimeout(() => {
        setShowTyping(false)
        setMessages((prev) => [
          ...prev,
          {
            type: "bot",
            content: `The term "BOME" can refer to several distinct entities across different fields:

1. Book of Meme (BOME)

Book of Meme (BOME) is a memecoin integrated into an experimental project known as the Book of Meme. Launched on the Solana blockchain, BOME serves as the primary utility token within the Book of Meme ecosystem. Inspired by vibrant meme culture, BOME aims to reshape web3 culture by combining memes with decentralized storage solutions, cryptocurrency trading, and gambling. The project utilizes decentralized storage solutions like Arweave and IPFS to permanently preserve meme culture on the blockchain. The BOME token operates on the Solana blockchain and is used within the ecosystem to facilitate transactions, trading, and gambling. The Book of Meme project seeks to establish the digital equivalent of a traditional book.`,
            timestamp: "9:45 AM",
          },
        ])
      }, 2000)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col relative">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <Link href="/home" aria-label="Go back to home">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden="true">
            <path
              d="M19 12H5M12 19L5 12L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <h1 className="text-lg sm:text-xl font-bold text-white">PrepX AI</h1>

        <button aria-label="Share conversation" className="text-white hover:text-gray-300 transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden="true">
            <path
              d="M4 12V12.01M12 12V12.01M20 12V12.01M8 8L16 16M16 8L8 16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      {/* Chat Content */}
      <main
        className="flex-1 px-3 sm:px-4 md:px-6 pb-28 sm:pb-32 space-y-3 sm:space-y-4 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Chat conversation"
      >
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
            {message.type === "user" ? (
              <div className="bg-[#8759ff] rounded-3xl px-4 sm:px-6 py-3 sm:py-4 max-w-[85%] sm:max-w-[280px] md:max-w-[320px]">
                <p className="text-white text-sm sm:text-base leading-relaxed">{message.content}</p>
              </div>
            ) : (
              <div className="bg-[#1a1a1a] rounded-3xl px-4 sm:px-6 py-3 sm:py-4 max-w-[90%] sm:max-w-[320px] md:max-w-[380px] border border-[#262626]">
                <p className="text-white text-sm sm:text-base leading-relaxed whitespace-pre-line">{message.content}</p>
              </div>
            )}
          </div>
        ))}

        {showTyping && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a1a] rounded-3xl px-4 sm:px-6 py-3 sm:py-4 border border-[#262626]">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-[#8759ff] rounded-full animate-pulse"></div>
                <div
                  className="w-2 h-2 bg-[#8759ff] rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-[#8759ff] rounded-full animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {tradingPhase === "initial" && (
          <div className="space-y-3">
            {/* Technical Analysis */}
            <Card className="bg-[#1a1a1a] border-[#262626] rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection("technical")}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center space-x-3">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#27c47d]">
                    <path
                      d="M2 18L7 13L11 17L18 2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M18 2L13 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div>
                    <h3 className="text-white font-semibold">Technical Analysis</h3>
                    <p className="text-[#b4b4b4] text-sm">
                      AI analyzed market patterns and identified optimal entry points
                    </p>
                  </div>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  className={`text-white transition-transform ${expandedSections.includes("technical") ? "rotate-180" : ""}`}
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </Card>

            {/* Risk Management */}
            <Card className="bg-[#1a1a1a] border-[#262626] rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection("risk")}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center space-x-3">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#27c47d]">
                    <path
                      d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div>
                    <h3 className="text-white font-semibold">Risk Management</h3>
                    <p className="text-[#b4b4b4] text-sm">Dynamic stop-loss and position sizing calculated</p>
                  </div>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  className={`text-white transition-transform ${expandedSections.includes("risk") ? "rotate-180" : ""}`}
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </Card>

            {/* Trade Execution */}
            <Card className="bg-[#1a1a1a] border-[#262626] rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection("execution")}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center space-x-3">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#facc15]">
                    <path
                      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div>
                    <h3 className="text-white font-semibold">Trade Execution</h3>
                    <p className="text-[#b4b4b4] text-sm">Preparing to execute trades based on analysis</p>
                  </div>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  className={`text-white transition-transform ${expandedSections.includes("execution") ? "rotate-180" : ""}`}
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </Card>
          </div>
        )}

        {tradingPhase === "active" && (
          <div className="space-y-4">
            {/* Preparing message */}
            <Card className="bg-[#1a1a1a] border-[#262626] rounded-2xl p-4">
              <p className="text-[#b4b4b4] text-sm sm:text-base">Preparing to execute trades based on analysis</p>
            </Card>

            {/* LINK/USD Position Detail */}
            <Card className="bg-[#1a1a1a] border-[#262626] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-[#2563eb] rounded-full flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2L8 14L2 8L14 8L8 2Z" fill="white" />
                    </svg>
                  </div>
                  <span className="text-white font-semibold">LINK/USD</span>
                  <span className="bg-[#dc3545] text-white px-2 py-1 rounded text-xs font-medium">SELL</span>
                  <span className="text-white font-semibold">31x</span>
                </div>
                <button className="text-[#b4b4b4] hover:text-white">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-[#b4b4b4]">Entry Price</span>
                  <span className="text-white">25.993</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#b4b4b4]">Position</span>
                  <span className="text-white">589 USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#b4b4b4]">Collateral</span>
                  <span className="text-white">19 USDC</span>
                </div>
                <hr className="border-[#262626]" />
                <div className="flex justify-between">
                  <span className="text-[#b4b4b4]">Liq. Price</span>
                  <span className="text-[#dc3545]">26.827</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#b4b4b4]">SL/TP</span>
                  <span className="text-white text-sm">1844674407.3709 / 18.3823</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#b4b4b4]">PnL</span>
                  <span className="text-[#27c47d]">+1.76 USDC (+9.05%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#b4b4b4]">Est. Exit Fee</span>
                  <span className="text-white">-0.48 USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#b4b4b4]">Est. Funding Fee</span>
                  <span className="text-white">-0.0149 USDC</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-white">You'll Receive</span>
                  <span className="text-white">20.7749 USDC</span>
                </div>
              </div>

              <Button
                onClick={() => handleClosePosition("link")}
                disabled={closingPositions.includes("link")}
                className="w-full bg-[#8759ff] hover:bg-[#7c4dff] text-white rounded-xl py-3"
              >
                {closingPositions.includes("link") ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  "Close Position"
                )}
              </Button>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#262626]">
                <div>
                  <p className="text-[#b4b4b4] text-sm">Position Size</p>
                  <p className="text-white font-semibold">449.64 USDC</p>
                </div>
                <div>
                  <p className="text-[#b4b4b4] text-sm">Collateral</p>
                  <p className="text-white font-semibold">14.988 USDC</p>
                </div>
              </div>

              <p className="text-[#b4b4b4] text-sm mt-3">
                Entry price is <span className="text-white">1.95</span>. Liquidation at{" "}
                <span className="text-white">2.0145</span>.
              </p>
            </Card>
          </div>
        )}

        {tradingPhase === "completed" && (
          <div className="space-y-4 mt-6">
            {/* Position Closed - INJ/USD */}
            <Card className="bg-[#1a1a1a] border-l-4 border-l-[#27c47d] border-[#262626] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#27c47d] text-sm font-medium">Position closed</span>
                <span className="text-[#b4b4b4] text-sm">9:48 AM</span>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-[#00d4aa] rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">I</span>
                  </div>
                  <span className="text-white font-semibold">INJ/USD</span>
                  <span className="bg-[#dc3545] text-white px-2 py-1 rounded text-xs font-medium">SELL</span>
                </div>
                <span className="text-[#b4b4b4] text-sm">30x</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-[#b4b4b4] text-sm">PnL</p>
                  <p className="text-[#27c47d] font-semibold">+9.941 USDC</p>
                </div>
                <div>
                  <p className="text-[#b4b4b4] text-sm">Collateral</p>
                  <p className="text-white font-semibold">14.988 USDC</p>
                </div>
                <div>
                  <p className="text-[#b4b4b4] text-sm">Entry Price</p>
                  <p className="text-white">13.68</p>
                </div>
                <div>
                  <p className="text-[#b4b4b4] text-sm">Exit Price</p>
                  <p className="text-white">13.3833</p>
                </div>
                <div>
                  <p className="text-[#b4b4b4] text-sm">Position Size</p>
                  <p className="text-white">449.64 USDC</p>
                </div>
                <div>
                  <p className="text-[#b4b4b4] text-sm">Status</p>
                  <p className="text-white">Closed</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {tradingPhase === "conversation" && (
          <div className="flex items-center space-x-2 px-2 sm:px-4">
            <div className="w-2 h-2 bg-[#8759ff] rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-[#8759ff] rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
          </div>
        )}
      </main>

      {/* Bottom Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0d0d0d] p-3 sm:p-4 border-t border-[#1a1a1a]">
        <div className="flex items-center space-x-2 sm:space-x-3 bg-[#262626] rounded-full px-3 sm:px-4 py-2.5 sm:py-3 max-w-full">
          <button className="flex-shrink-0 p-1">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-white sm:w-5 sm:h-5">
              <path
                d="M1.4 10.9C1.4 14.9 4.6 18.1 8.6 18.1C11.4 18.1 13.8 16.4 15 13.9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18.6 9.1C18.6 5.1 15.4 1.9 11.4 1.9C8.6 1.9 6.2 3.6 5 6.1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13 16L15 14L17 16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7 4L5 6L3 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <input
            type="text"
            placeholder="Chat with agent"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 bg-transparent text-white placeholder:text-[#696969] outline-none text-sm sm:text-base min-w-0"
          />

          <button className="flex-shrink-0 p-1">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-white sm:w-5 sm:h-5">
              <path
                d="M10 15L15 10L10 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M15 10H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            onClick={handleSendMessage}
            className="w-8 h-8 sm:w-10 sm:h-10 bg-[#8759ff] rounded-full flex items-center justify-center flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-white sm:w-4 sm:h-4">
              <path d="M8 3L8 13M8 3L4 7M8 3L12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="text-[#696969] text-xs text-center mt-2 sm:mt-3">Trade prompt costs 0.05 a-gPT</p>
      </div>

      {/* Small Terminal Widget */}
      {!isTerminalExpanded && (
        <div
          className={`terminal-widget fixed z-50 transition-all duration-75 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            right: `${terminalPosition.right}px`,
            bottom: `${terminalPosition.bottom}px`,
          }}
        >
          <div
            className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-3 shadow-lg hover:bg-[#262626] transition-colors select-none"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onClick={handleTerminalClick}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1">
                <div className="w-1 h-1 bg-[#696969] rounded-full"></div>
                <div className="w-1 h-1 bg-[#696969] rounded-full"></div>
                <div className="w-1 h-1 bg-[#696969] rounded-full"></div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-[#27c47d] rounded-full animate-pulse"></div>
              <span className="text-white text-xs font-medium">Live</span>
            </div>
            <div className="mt-2 text-xs text-[#b4b4b4]">
              <div className="flex items-center space-x-1">
                <span className="text-[#27c47d]">●</span>
                <span>Monitoring trade 15</span>
              </div>
              <div className="text-[#facc15]">PnL: $0.00 / $30</div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Terminal Overlay */}
      {isTerminalExpanded && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-[#0d0d0d] rounded-t-3xl animate-slide-up max-h-[85vh] sm:max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#262626] flex-shrink-0">
              <h2 className="text-white text-lg sm:text-xl font-bold">Live Trading Activity</h2>
              <button onClick={toggleTerminal} className="text-white hover:text-[#b4b4b4] p-1">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Monitoring Status */}
              <Card className="bg-[#1a1a1a] border-[#262626] rounded-xl p-3 sm:p-4">
                <div className="flex items-start space-x-2 mb-3">
                  <div className="w-4 h-4 bg-[#2563eb] rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">💻</span>
                  </div>
                  <span className="text-[#58a6ff] font-mono text-xs sm:text-sm break-all">
                    ********** Monitoring trade 15**********
                  </span>
                </div>

                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="text-[#b4b4b4]">Total allowed positions: 4 for budget is 60</div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[#facc15] flex-shrink-0">💰</span>
                    <span className="text-white">Total PnL: $0.00 / $30</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[#b4b4b4] flex-shrink-0">🔒</span>
                    <span className="text-white">Open positions: 0</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-[#27c47d] flex-shrink-0 mt-0.5">✅</span>
                    <span className="text-white break-words">
                      Tokens to watch: INJ_USD, ARB_USD, ZRO_USD, SUI_USD, ENA_USD, ADA_USD
                    </span>
                  </div>
                </div>
              </Card>

              {/* Technical Analysis */}
              <Card className="bg-[#1a1a1a] border-[#262626] rounded-xl p-3 sm:p-4">
                <div className="flex items-start space-x-2 mb-3">
                  <span className="text-[#58a6ff] flex-shrink-0">📊</span>
                  <span className="text-white font-mono text-xs sm:text-sm break-words">
                    [Check] Regime: bearish, RSI: 38.11, MACD: -0.01224, MACDA: 0.00346, EMA Slope: -0.00752, ADX: 10,
                    ATR%: 0.59%, Score: 0.40
                  </span>
                </div>

                <div className="flex items-start space-x-2 mb-3">
                  <span className="text-[#b4b4b4] flex-shrink-0">⚪</span>
                  <span className="text-white font-mono text-xs sm:text-sm break-words">
                    [Indicators] RSI: 38.11 | MACD Hist: -0.012237 | EMA Slope: -0.00752 | ATR%: 0.59%
                  </span>
                </div>

                <div className="flex items-start space-x-2">
                  <span className="text-[#f472b6] flex-shrink-0">🎯</span>
                  <span className="text-white font-mono text-xs sm:text-sm break-words">
                    [Decision] INJ_USD | Open: <span className="text-[#27c47d]">true</span> | Reason: Bearish trend
                    continuation | Confidence: <span className="text-[#27c47d]">high</span>
                  </span>
                </div>
              </Card>

              {/* Trade Execution */}
              <Card className="bg-[#1a1a1a] border-[#262626] rounded-xl p-3 sm:p-4">
                <div className="space-y-3 font-mono text-xs sm:text-sm">
                  <div className="flex items-start space-x-2">
                    <span className="text-[#dc3545] flex-shrink-0">📉</span>
                    <span className="text-white break-words">
                      INJ_USD | SignalScore: 0.40 | Regime: bearish | Decision:{" "}
                      <span className="text-[#dc3545]">short</span>
                    </span>
                  </div>

                  <div className="flex items-start space-x-2">
                    <span className="text-[#dc3545] flex-shrink-0">📈</span>
                    <span className="text-white break-words">
                      Executing INJ_USD | <span className="text-[#dc3545]">SHORT</span> | Entry: 13.680000 | Lev: 30x
                    </span>
                  </div>

                  <div className="flex items-start space-x-2">
                    <span className="text-[#27c47d] flex-shrink-0">✅</span>
                    <span className="text-white break-all">
                      Opened INJ_USD | <span className="text-[#dc3545]">SHORT</span> | TX:
                      0x5c4fac3d32bbf61d97494c5ade6cafd3bc7438b
                    </span>
                  </div>

                  <div className="flex items-start space-x-2">
                    <span className="text-[#b4b4b4] flex-shrink-0">🔒</span>
                    <span className="text-white">Opened position for INJ_USD</span>
                  </div>
                </div>
              </Card>

              <div className="h-4"></div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
