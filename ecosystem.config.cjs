/**
 * PM2 production config — tránh crash loop OOM / restart bão.
 * Deploy: pm2 startOrReload ecosystem.config.cjs --env production && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'dashboardthangtinhoc',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '700M',
      exp_backoff_restart_delay: 2000,
      min_uptime: '10s',
      max_restarts: 20,
      kill_timeout: 8000,
      listen_timeout: 15000,
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
