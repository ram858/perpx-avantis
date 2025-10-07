// Comprehensive validation utilities

export interface ValidationRule {
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  custom?: (value: any) => boolean | string
  message?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export class Validator {
  private rules: Record<string, ValidationRule[]> = {}

  // Add validation rules for a field
  addRule(field: string, rule: ValidationRule): Validator {
    if (!this.rules[field]) {
      this.rules[field] = []
    }
    this.rules[field].push(rule)
    return this
  }

  // Validate a single field
  validateField(field: string, value: any): ValidationResult {
    const fieldRules = this.rules[field] || []
    const errors: string[] = []
    const warnings: string[] = []

    for (const rule of fieldRules) {
      const result = this.validateRule(value, rule)
      if (result.error) {
        errors.push(result.error)
      }
      if (result.warning) {
        warnings.push(result.warning)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Validate all fields in an object
  validateObject(data: Record<string, any>): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {}

    for (const field in this.rules) {
      results[field] = this.validateField(field, data[field])
    }

    return results
  }

  private validateRule(value: any, rule: ValidationRule): { error?: string; warning?: string } {
    // Required validation
    if (rule.required && (value === undefined || value === null || value === '')) {
      return { error: rule.message || 'This field is required' }
    }

    // Skip other validations if value is empty and not required
    if (!rule.required && (value === undefined || value === null || value === '')) {
      return {}
    }

    // Min/Max validation for numbers
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return { error: rule.message || `Value must be at least ${rule.min}` }
      }
      if (rule.max !== undefined && value > rule.max) {
        return { error: rule.message || `Value must be at most ${rule.max}` }
      }
    }

    // Min/Max validation for strings
    if (typeof value === 'string') {
      if (rule.min !== undefined && value.length < rule.min) {
        return { error: rule.message || `Must be at least ${rule.min} characters` }
      }
      if (rule.max !== undefined && value.length > rule.max) {
        return { error: rule.message || `Must be at most ${rule.max} characters` }
      }
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return { error: rule.message || 'Invalid format' }
    }

    // Custom validation
    if (rule.custom) {
      const result = rule.custom(value)
      if (typeof result === 'string') {
        return { error: result }
      }
      if (result === false) {
        return { error: rule.message || 'Invalid value' }
      }
    }

    return {}
  }

  // Clear all rules
  clear(): Validator {
    this.rules = {}
    return this
  }

  // Remove rules for a specific field
  clearField(field: string): Validator {
    delete this.rules[field]
    return this
  }
}

// Common validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  walletAddress: /^0x[a-fA-F0-9]{40}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  decimal: /^\d+\.?\d*$/,
  integer: /^\d+$/,
  url: /^https?:\/\/.+/,
} as const

// Common validation rules
export const VALIDATION_RULES = {
  required: (message?: string): ValidationRule => ({
    required: true,
    message: message || 'This field is required'
  }),

  email: (message?: string): ValidationRule => ({
    pattern: VALIDATION_PATTERNS.email,
    message: message || 'Please enter a valid email address'
  }),

  phone: (message?: string): ValidationRule => ({
    pattern: VALIDATION_PATTERNS.phone,
    message: message || 'Please enter a valid phone number'
  }),

  walletAddress: (message?: string): ValidationRule => ({
    pattern: VALIDATION_PATTERNS.walletAddress,
    message: message || 'Please enter a valid wallet address'
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    min,
    message: message || `Must be at least ${min} characters`
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    max,
    message: message || `Must be at most ${max} characters`
  }),

  minValue: (min: number, message?: string): ValidationRule => ({
    min,
    message: message || `Value must be at least ${min}`
  }),

  maxValue: (max: number, message?: string): ValidationRule => ({
    max,
    message: message || `Value must be at most ${max}`
  }),

  range: (min: number, max: number, message?: string): ValidationRule => ({
    min,
    max,
    message: message || `Value must be between ${min} and ${max}`
  }),

  positive: (message?: string): ValidationRule => ({
    min: 0.01,
    message: message || 'Value must be positive'
  }),

  nonNegative: (message?: string): ValidationRule => ({
    min: 0,
    message: message || 'Value must be non-negative'
  }),

  integer: (message?: string): ValidationRule => ({
    pattern: VALIDATION_PATTERNS.integer,
    message: message || 'Value must be a whole number'
  }),

  decimal: (message?: string): ValidationRule => ({
    pattern: VALIDATION_PATTERNS.decimal,
    message: message || 'Value must be a valid number'
  }),
} as const

// Trading-specific validation rules
export const TRADING_VALIDATION = {
  budget: (maxBalance: number = 10000): ValidationRule[] => [
    VALIDATION_RULES.required('Investment amount is required'),
    VALIDATION_RULES.minValue(10, 'Minimum investment is $10'),
    VALIDATION_RULES.maxValue(maxBalance, `Maximum investment is $${maxBalance}`),
    VALIDATION_RULES.decimal('Please enter a valid amount')
  ],

  profitGoal: (budget: number): ValidationRule[] => [
    VALIDATION_RULES.required('Profit goal is required'),
    VALIDATION_RULES.minValue(1, 'Minimum profit goal is $1'),
    VALIDATION_RULES.maxValue(budget * 0.5, 'Profit goal cannot exceed 50% of budget'),
    VALIDATION_RULES.decimal('Please enter a valid profit goal')
  ],

  maxPositions: (): ValidationRule[] => [
    VALIDATION_RULES.required('Maximum positions is required'),
    VALIDATION_RULES.minValue(1, 'Minimum 1 position required'),
    VALIDATION_RULES.maxValue(10, 'Maximum 10 positions allowed'),
    VALIDATION_RULES.integer('Must be a whole number')
  ],

  leverage: (): ValidationRule[] => [
    VALIDATION_RULES.required('Leverage is required'),
    VALIDATION_RULES.minValue(1, 'Minimum leverage is 1x'),
    VALIDATION_RULES.maxValue(20, 'Maximum leverage is 20x'),
    VALIDATION_RULES.integer('Must be a whole number')
  ],
} as const

// Wallet validation rules
export const WALLET_VALIDATION = {
  address: (): ValidationRule[] => [
    VALIDATION_RULES.required('Wallet address is required'),
    VALIDATION_RULES.walletAddress('Please enter a valid Ethereum wallet address')
  ],

  privateKey: (): ValidationRule[] => [
    VALIDATION_RULES.required('Private key is required'),
    {
      pattern: /^[a-fA-F0-9]{64}$/,
      message: 'Please enter a valid 64-character private key'
    }
  ],
} as const

// Auth validation rules
export const AUTH_VALIDATION = {
  phoneNumber: (): ValidationRule[] => [
    VALIDATION_RULES.required('Phone number is required'),
    VALIDATION_RULES.phone('Please enter a valid phone number')
  ],

  otp: (): ValidationRule[] => [
    VALIDATION_RULES.required('OTP code is required'),
    {
      pattern: /^\d{6}$/,
      message: 'Please enter a 6-digit OTP code'
    }
  ],
} as const

// Utility functions for common validations
export const validateEmail = (email: string): boolean => {
  return VALIDATION_PATTERNS.email.test(email)
}

export const validateWalletAddress = (address: string): boolean => {
  return VALIDATION_PATTERNS.walletAddress.test(address)
}

export const validatePhoneNumber = (phone: string): boolean => {
  return VALIDATION_PATTERNS.phone.test(phone)
}

export const validateTradingBudget = (budget: number, maxBalance: number): ValidationResult => {
  const validator = new Validator()
  validator.addRule('budget', VALIDATION_RULES.required())
  validator.addRule('budget', VALIDATION_RULES.minValue(10))
  validator.addRule('budget', VALIDATION_RULES.maxValue(maxBalance))
  
  return validator.validateField('budget', budget)
}

export const validateProfitGoal = (profitGoal: number, budget: number): ValidationResult => {
  const validator = new Validator()
  validator.addRule('profitGoal', VALIDATION_RULES.required())
  validator.addRule('profitGoal', VALIDATION_RULES.minValue(1))
  validator.addRule('profitGoal', VALIDATION_RULES.maxValue(budget * 0.5))
  
  return validator.validateField('profitGoal', profitGoal)
}

// React hook for validation
export function useValidation() {
  const createValidator = () => new Validator()

  const validateForm = (data: Record<string, any>, rules: Record<string, ValidationRule[]>) => {
    const validator = new Validator()
    
    for (const field in rules) {
      for (const rule of rules[field]) {
        validator.addRule(field, rule)
      }
    }
    
    return validator.validateObject(data)
  }

  const isFormValid = (results: Record<string, ValidationResult>): boolean => {
    return Object.values(results).every(result => result.isValid)
  }

  const getFormErrors = (results: Record<string, ValidationResult>): Record<string, string[]> => {
    const errors: Record<string, string[]> = {}
    
    for (const field in results) {
      if (!results[field].isValid) {
        errors[field] = results[field].errors
      }
    }
    
    return errors
  }

  return {
    createValidator,
    validateForm,
    isFormValid,
    getFormErrors,
    VALIDATION_RULES,
    TRADING_VALIDATION,
    WALLET_VALIDATION,
    AUTH_VALIDATION,
  }
}
