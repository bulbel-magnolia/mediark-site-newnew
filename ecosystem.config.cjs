// PM2 进程管理配置
module.exports = {
  apps: [{
    name: "mediark",
    script: "server/start.js",
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "2G",
    kill_timeout: 10000,
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
};
