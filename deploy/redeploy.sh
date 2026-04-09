#!/usr/bin/env bash
set -euo pipefail

# MediArk 快速重新部署脚本（代码更新后运行）
cd /opt/mediark
git pull
npm install --production
pm2 restart mediark
echo "重新部署完成！"
