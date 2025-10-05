import { DataSource } from 'typeorm'
import { Wallet } from './entities/Wallet'
import { User } from './entities/User'
import { Otp } from './entities/Otp'

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  database: process.env.POSTGRES_DB || 'prepx',
  entities: [User, Wallet, Otp],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize()
    console.log('Database connection established')
  } catch (error) {
    console.error('Database connection failed:', error)
    throw error
  }
}
