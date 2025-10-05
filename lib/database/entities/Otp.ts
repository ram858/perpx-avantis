import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity('otps')
@Index(['phoneNumber', 'code'], { unique: true })
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string

  @Column({ type: 'varchar', length: 6 })
  code: string

  @Column({ type: 'boolean', default: false })
  isVerified: boolean

  @Column({ type: 'timestamp' })
  expiresAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  // Helper method to check if OTP is expired
  isExpired(): boolean {
    return new Date() > this.expiresAt
  }

  // Helper method to check if OTP is valid (not expired and not verified)
  isValid(): boolean {
    return !this.isExpired() && !this.isVerified
  }
}
