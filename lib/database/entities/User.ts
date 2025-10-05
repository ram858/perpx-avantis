import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm'
import { Wallet } from './Wallet'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 20, unique: true })
  phoneNumber: string

  @Column({ type: 'boolean', default: false })
  isVerified: boolean

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(() => Wallet, wallet => wallet.phoneNumber)
  wallets: Wallet[]
}
