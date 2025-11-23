import crypto from 'crypto'

export class EncryptionService {
  private algorithm: string | null = null
  private secret: string | null = null
  private ivLength: number | null = null

  constructor() {
    // Don't validate at construction time - validate at runtime when methods are called
    // This allows the service to be instantiated during build without env vars
  }

  // Lazy initialization - validate and get config at runtime
  private ensureInitialized(): void {
    if (this.secret === null) {
      this.algorithm = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm'
      if (!process.env.ENCRYPTION_SECRET) {
        throw new Error(
          'ENCRYPTION_SECRET environment variable is required. Set a 32-character secret in your server environment.'
        )
      }
      this.secret = process.env.ENCRYPTION_SECRET
      this.ivLength = parseInt(process.env.IV_LENGTH || '16')
    }
  }

  encrypt(text: string): { encrypted: string; iv: string } {
    this.ensureInitialized()
    const iv = crypto.randomBytes(this.ivLength!)
    const key = crypto.scryptSync(this.secret!, 'salt', 32)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    return {
      encrypted,
      iv: iv.toString('hex')
    }
  }

  decrypt(encryptedText: string, iv: string): string {
    this.ensureInitialized()
    const key = crypto.scryptSync(this.secret!, 'salt', 32)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'))
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  // Alternative method using GCM for better security
  encryptGCM(text: string): { encrypted: string; iv: string; authTag: string } {
    this.ensureInitialized()
    const iv = crypto.randomBytes(this.ivLength!)
    const key = crypto.scryptSync(this.secret!, 'salt', 32)
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
    this.ensureInitialized()
    const key = crypto.scryptSync(this.secret!, 'salt', 32)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}
