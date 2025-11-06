module.exports = {
  apps: [
    {
      name: 'perpx-nextjs',
      cwd: process.cwd(),
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
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

