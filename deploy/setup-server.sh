#!/usr/bin/env bash
set -euo pipefail

# MediArk 阿里云服务器一键初始化脚本
# 在全新 Ubuntu 24.04 上运行

echo "=== [1/6] 更新系统 ==="
apt-get update && apt-get upgrade -y

echo "=== [2/6] 安装基础工具 ==="
apt-get install -y git curl build-essential nginx

echo "=== [3/6] 安装 Node.js 22 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

echo "=== [4/6] 安装 PM2 ==="
npm install -g pm2

echo "=== [5/6] 克隆项目 ==="
mkdir -p /opt
if [ -d "/opt/mediark" ]; then
  echo "项目目录已存在，执行 git pull"
  cd /opt/mediark && git pull
else
  git clone https://github.com/bulbel-magnolia/mediark-site-newnew.git /opt/mediark
fi
cd /opt/mediark
npm install --production

echo "=== [6/6] 配置 Nginx ==="
cp /opt/mediark/deploy/nginx-mediark.conf /etc/nginx/sites-available/mediark
ln -sf /etc/nginx/sites-available/mediark /etc/nginx/sites-enabled/mediark
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
systemctl enable nginx

echo ""
echo "============================================"
echo "  初始化完成！接下来："
echo "  1. 编辑环境变量:  nano /opt/mediark/.env"
echo "  2. 启动服务:      cd /opt/mediark && pm2 start server/start.js --name mediark"
echo "  3. 设置开机自启:  pm2 save && pm2 startup"
echo "  4. 浏览器访问:    http://47.95.248.123"
echo "============================================"
