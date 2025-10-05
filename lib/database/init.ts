import { initializeDatabase } from './config'

// Initialize database connection
export async function initDatabase() {
  try {
    await initializeDatabase()
    console.log('✅ Database initialized successfully')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    process.exit(1)
  }
}

// Auto-initialize if this file is run directly
if (require.main === module) {
  initDatabase()
}
