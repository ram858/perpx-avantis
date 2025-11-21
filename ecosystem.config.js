module.exports = {
  apps: [
    {
      name: 'perpx-nextjs',
      cwd: process.cwd(),
      script: 'npm',
      args: 'start',
      // Environment variables can be set here or via system environment
      // PM2 will merge system env vars with these values
      // For CI/CD: Set env vars in your deployment platform, PM2 will use them
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Add your runtime environment variables here or set them in system env
        // JWT_SECRET: process.env.JWT_SECRET,
        // ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,
        // TRADING_ENGINE_URL: process.env.TRADING_ENGINE_URL,
        // AVANTIS_API_URL: process.env.AVANTIS_API_URL,
        // AVANTIS_NETWORK: process.env.AVANTIS_NETWORK,
        // NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        // NEXT_PUBLIC_AVANTIS_NETWORK: process.env.NEXT_PUBLIC_AVANTIS_NETWORK,
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/pm2/perpx-nextjs-error.log',
      out_file: './logs/pm2/perpx-nextjs-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'perpx-trading-engine',
      cwd: './trading-engine',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3001
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      error_file: './logs/pm2/perpx-trading-engine-error.log',
      out_file: './logs/pm2/perpx-trading-engine-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};

