import crypto from 'crypto'

export class EncryptionService {
  private readonly algorithm: string
  private readonly secret: string
  private readonly ivLength: number

  constructor() {
    this.algorithm = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm'
    if (!process.env.ENCRYPTION_SECRET) {
      throw new Error(
        'ENCRYPTION_SECRET environment variable is required. Set a 32-character secret in your server environment.'
      )
    }
    this.secret = process.env.ENCRYPTION_SECRET
    this.ivLength = parseInt(process.env.IV_LENGTH || '16')
  }

  encrypt(text: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(this.ivLength)
    const key = crypto.scryptSync(this.secret, 'salt', 32)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    return {
      encrypted,
      iv: iv.toString('hex')
    }
  }

  decrypt(encryptedText: string, iv: string): string {
    const key = crypto.scryptSync(this.secret, 'salt', 32)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'))
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  // Alternative method using GCM for better security
  encryptGCM(text: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(this.ivLength)
    const key = crypto.scryptSync(this.secret, 'salt', 32)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    }
  }

  decryptGCM(encryptedText: string, iv: string, authTag: string): string {
    const key = crypto.scryptSync(this.secret, 'salt', 32)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}
