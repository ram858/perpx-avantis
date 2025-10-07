// Comprehensive error handling utilities

export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  timestamp?: Date
  metadata?: Record<string, any>
}

export class AppError extends Error {
  public readonly code: string
  public readonly context: ErrorContext
  public readonly severity: 'low' | 'medium' | 'high' | 'critical'

  constructor(
    message: string,
    code: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context: ErrorContext = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.severity = severity
    this.context = {
      ...context,
      timestamp: new Date()
    }
  }
}

// Error codes for consistent error handling
export const ERROR_CODES = {
  // Authentication errors
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  
  // Wallet errors
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  WALLET_INSUFFICIENT_BALANCE: 'WALLET_INSUFFICIENT_BALANCE',
  WALLET_TRANSACTION_FAILED: 'WALLET_TRANSACTION_FAILED',
  
  // Trading errors
  TRADING_SESSION_FAILED: 'TRADING_SESSION_FAILED',
  TRADING_INVALID_CONFIG: 'TRADING_INVALID_CONFIG',
  TRADING_MARKET_CLOSED: 'TRADING_MARKET_CLOSED',
  
  // Network errors
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_FAILED: 'NETWORK_CONNECTION_FAILED',
  NETWORK_RATE_LIMITED: 'NETWORK_RATE_LIMITED',
  
  // API errors
  API_SERVER_ERROR: 'API_SERVER_ERROR',
  API_BAD_REQUEST: 'API_BAD_REQUEST',
  API_UNAUTHORIZED: 'API_UNAUTHORIZED',
  API_FORBIDDEN: 'API_FORBIDDEN',
  API_NOT_FOUND: 'API_NOT_FOUND',
  
  // Validation errors
  VALIDATION_INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  VALIDATION_MISSING_REQUIRED: 'VALIDATION_MISSING_REQUIRED',
  VALIDATION_OUT_OF_RANGE: 'VALIDATION_OUT_OF_RANGE',
  
  // System errors
  SYSTEM_UNKNOWN_ERROR: 'SYSTEM_UNKNOWN_ERROR',
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
} as const

// User-friendly error messages
export const ERROR_MESSAGES = {
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ERROR_CODES.AUTH_TOKEN_INVALID]: 'Invalid authentication. Please log in again.',
  [ERROR_CODES.AUTH_USER_NOT_FOUND]: 'User account not found. Please contact support.',
  
  [ERROR_CODES.WALLET_NOT_CONNECTED]: 'Please connect your wallet to continue.',
  [ERROR_CODES.WALLET_INSUFFICIENT_BALANCE]: 'Insufficient balance for this transaction.',
  [ERROR_CODES.WALLET_TRANSACTION_FAILED]: 'Transaction failed. Please try again.',
  
  [ERROR_CODES.TRADING_SESSION_FAILED]: 'Failed to start trading session. Please try again.',
  [ERROR_CODES.TRADING_INVALID_CONFIG]: 'Invalid trading configuration. Please check your settings.',
  [ERROR_CODES.TRADING_MARKET_CLOSED]: 'Trading is currently unavailable. Market is closed.',
  
  [ERROR_CODES.NETWORK_TIMEOUT]: 'Request timed out. Please check your connection and try again.',
  [ERROR_CODES.NETWORK_CONNECTION_FAILED]: 'Connection failed. Please check your internet connection.',
  [ERROR_CODES.NETWORK_RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  
  [ERROR_CODES.API_SERVER_ERROR]: 'Server error occurred. Please try again later.',
  [ERROR_CODES.API_BAD_REQUEST]: 'Invalid request. Please check your input and try again.',
  [ERROR_CODES.API_UNAUTHORIZED]: 'You are not authorized to perform this action.',
  [ERROR_CODES.API_FORBIDDEN]: 'Access denied. You do not have permission for this action.',
  [ERROR_CODES.API_NOT_FOUND]: 'The requested resource was not found.',
  
  [ERROR_CODES.VALIDATION_INVALID_INPUT]: 'Invalid input provided. Please check your data.',
  [ERROR_CODES.VALIDATION_MISSING_REQUIRED]: 'Required fields are missing.',
  [ERROR_CODES.VALIDATION_OUT_OF_RANGE]: 'Value is outside the allowed range.',
  
  [ERROR_CODES.SYSTEM_UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
  [ERROR_CODES.SYSTEM_MAINTENANCE]: 'System is under maintenance. Please try again later.',
} as const

// Error severity levels
export const ERROR_SEVERITY = {
  low: {
    level: 1,
    userAction: 'none',
    logging: 'debug'
  },
  medium: {
    level: 2,
    userAction: 'retry',
    logging: 'warn'
  },
  high: {
    level: 3,
    userAction: 'contact_support',
    logging: 'error'
  },
  critical: {
    level: 4,
    userAction: 'immediate_attention',
    logging: 'critical'
  }
} as const

// Error handler class
export class ErrorHandler {
  private static instance: ErrorHandler
  private errorLog: AppError[] = []
  private maxLogSize = 100

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  // Handle and categorize errors
  handleError(error: Error | AppError, context: ErrorContext = {}): AppError {
    let appError: AppError

    if (error instanceof AppError) {
      appError = error
    } else {
      // Convert regular Error to AppError
      appError = new AppError(
        error.message,
        ERROR_CODES.SYSTEM_UNKNOWN_ERROR,
        'medium',
        context
      )
    }

    // Add to error log
    this.addToLog(appError)

    // Log based on severity
    this.logError(appError)

    // Report critical errors
    if (appError.severity === 'critical') {
      this.reportCriticalError(appError)
    }

    return appError
  }

  // Create user-friendly error messages
  getUserMessage(error: AppError): string {
    return ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES] || ERROR_MESSAGES[ERROR_CODES.SYSTEM_UNKNOWN_ERROR]
  }

  // Get error severity info
  getSeverityInfo(error: AppError) {
    return ERROR_SEVERITY[error.severity]
  }

  // Check if error is retryable
  isRetryable(error: AppError): boolean {
    const retryableCodes = [
      ERROR_CODES.NETWORK_TIMEOUT,
      ERROR_CODES.NETWORK_CONNECTION_FAILED,
      ERROR_CODES.API_SERVER_ERROR,
      ERROR_CODES.TRADING_SESSION_FAILED,
      ERROR_CODES.WALLET_TRANSACTION_FAILED,
    ]
    return retryableCodes.includes(error.code as any)
  }

  // Get recommended user action
  getRecommendedAction(error: AppError): string {
    const severityInfo = this.getSeverityInfo(error)
    
    switch (severityInfo.userAction) {
      case 'retry':
        return 'Please try again in a moment.'
      case 'contact_support':
        return 'Please contact support if this issue persists.'
      case 'immediate_attention':
        return 'This is a critical issue. Please contact support immediately.'
      default:
        return ''
    }
  }

  private addToLog(error: AppError): void {
    this.errorLog.push(error)
    
    // Maintain max log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize)
    }
  }

  private logError(error: AppError): void {
    const severityInfo = this.getSeverityInfo(error)
    
    const logData = {
      message: error.message,
      code: error.code,
      severity: error.severity,
      context: error.context,
      stack: error.stack,
    }

    switch (severityInfo.logging) {
      case 'debug':
        console.debug('Error:', logData)
        break
      case 'warn':
        console.warn('Error:', logData)
        break
      case 'error':
        console.error('Error:', logData)
        break
      case 'critical':
        console.error('CRITICAL ERROR:', logData)
        break
    }
  }

  private reportCriticalError(error: AppError): void {
    // In production, this would send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error)
      console.error('CRITICAL ERROR REPORTED:', {
        message: error.message,
        code: error.code,
        context: error.context,
        timestamp: error.context.timestamp,
      })
    }
  }

  // Get recent errors for debugging
  getRecentErrors(limit = 10): AppError[] {
    return this.errorLog.slice(-limit)
  }

  // Clear error log
  clearLog(): void {
    this.errorLog = []
  }
}

// Utility functions for common error scenarios
export const createAuthError = (code: keyof typeof ERROR_CODES, context?: ErrorContext) => {
  return new AppError(ERROR_MESSAGES[code], ERROR_CODES[code], 'high', context)
}

export const createWalletError = (code: keyof typeof ERROR_CODES, context?: ErrorContext) => {
  return new AppError(ERROR_MESSAGES[code], ERROR_CODES[code], 'medium', context)
}

export const createTradingError = (code: keyof typeof ERROR_CODES, context?: ErrorContext) => {
  return new AppError(ERROR_MESSAGES[code], ERROR_CODES[code], 'medium', context)
}

export const createNetworkError = (code: keyof typeof ERROR_CODES, context?: ErrorContext) => {
  return new AppError(ERROR_MESSAGES[code], ERROR_CODES[code], 'medium', context)
}

export const createValidationError = (code: keyof typeof ERROR_CODES, context?: ErrorContext) => {
  return new AppError(ERROR_MESSAGES[code], ERROR_CODES[code], 'low', context)
}

// React hook for error handling
export function useErrorHandler() {
  const errorHandler = ErrorHandler.getInstance()

  const handleError = (error: Error | AppError, context?: ErrorContext) => {
    return errorHandler.handleError(error, context)
  }

  const getUserMessage = (error: AppError) => {
    return errorHandler.getUserMessage(error)
  }

  const isRetryable = (error: AppError) => {
    return errorHandler.isRetryable(error)
  }

  const getRecommendedAction = (error: AppError) => {
    return errorHandler.getRecommendedAction(error)
  }

  return {
    handleError,
    getUserMessage,
    isRetryable,
    getRecommendedAction,
  }
}
