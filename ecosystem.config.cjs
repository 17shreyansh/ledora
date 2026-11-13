// PM2 process definitions. API and workers scale independently.
module.exports = {
  apps: [
    {
      name: 'ledora-api',
      script: 'server/dist/server.js',
      exec_mode: 'cluster',
      instances: 'max',
      kill_timeout: 16000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'ledora-worker',
      script: 'server/dist/worker.js',
      exec_mode: 'fork',
      instances: 2,
      kill_timeout: 31000,
      env: { NODE_ENV: 'production' },
    },
  ],
};
