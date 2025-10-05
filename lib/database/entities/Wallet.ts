import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity('wallets')
@Index(['phoneNumber', 'chain'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string

  @Column({ type: 'varchar', length: 32 })
  iv: string

  @Column({ type: 'text' })
  privateKey: string

  @Column({ type: 'varchar', length: 50 })
  chain: string

  @Column({ type: 'varchar', length: 100 })
  address: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
