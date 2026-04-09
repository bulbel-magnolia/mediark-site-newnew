#!/usr/bin/env bash
# ============================================================
#  MediArk 一键部署脚本（阿里云/腾讯云 Ubuntu 22.04/24.04）
#  用法：
#    1. 买好服务器，用 SSH 登录
#    2. 把这个脚本传上去（或者 git clone 后执行）
#    3. sudo bash deploy.sh
#
#  执行完后用浏览器打开 http://服务器IP 即可访问
# ============================================================

set -e

REPO_URL="https://github.com/bulbel-magnolia/mediark-site-newnew.git"
APP_DIR="/opt/mediark"
NODE_VERSION="22"

echo ""
echo "=========================================="
echo "  MediArk 智瘤方舟 — 服务器部署"
echo "=========================================="
echo ""

# ---- 1. 系统更新 ----
echo "[1/7] 更新系统包..."
apt-get update -qq
apt-get install -y -qq curl git

# ---- 2. 安装 Node.js 22 ----
if command -v node &>/dev/null && node -v | grep -q "v${NODE_VERSION}"; then
    echo "[2/7] Node.js $(node -v) 已安装，跳过"
else
    echo "[2/7] 安装 Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
fi
echo "  Node: $(node -v)  npm: $(npm -v)"

# ---- 3. 安装 PM2 ----
if command -v pm2 &>/dev/null; then
    echo "[3/7] PM2 已安装，跳过"
else
    echo "[3/7] 安装 PM2 进程管理器..."
    npm install -g pm2
fi

# ---- 4. 拉取代码 ----
if [ -d "$APP_DIR/.git" ]; then
    echo "[4/7] 更新代码..."
    cd "$APP_DIR"
    git pull --ff-only
else
    echo "[4/7] 克隆仓库..."
    rm -rf "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ---- 5. 安装依赖 ----
echo "[5/7] 安装 npm 依赖..."
cd "$APP_DIR"
npm install --production

# ---- 6. 配置环境变量 ----
if [ ! -f "$APP_DIR/.env" ]; then
    echo "[6/7] 创建 .env 配置文件..."
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    echo ""
    echo "  ⚠️  请编辑 /opt/mediark/.env 填入 AI API 密钥！"
    echo "  命令: nano /opt/mediark/.env"
    echo ""
else
    echo "[6/7] .env 已存在，保留现有配置"
fi

# ---- 7. 端口映射（80 → 3000）----
echo "[7/7] 配置端口转发 (80 → 3000)..."
# 清理旧规则（防止重复添加）
iptables -t nat -D PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000 2>/dev/null || true
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000

# 保存 iptables 规则（重启不丢失）
if command -v netfilter-persistent &>/dev/null; then
    netfilter-persistent save
else
    apt-get install -y -qq iptables-persistent
    netfilter-persistent save
fi

# ---- 启动/重启应用 ----
echo ""
echo "启动 MediArk..."
cd "$APP_DIR"
pm2 delete mediark 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ---- 获取服务器 IP ----
SERVER_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "  访问地址:  http://${SERVER_IP}"
echo "  管理后台:  http://${SERVER_IP}/Admin.html"
echo ""
echo "  演示账号:"
echo "    医生:   doctor / doctor123"
echo "    审核:   reviewer / review123"
echo "    管理员: admin / admin123"
echo ""
echo "  常用命令:"
echo "    查看日志:   pm2 logs mediark"
echo "    重启服务:   pm2 restart mediark"
echo "    查看状态:   pm2 status"
echo "    编辑配置:   nano /opt/mediark/.env"
echo "    更新代码:   cd /opt/mediark && git pull && pm2 restart mediark"
echo ""
echo "  ⚠️  如果还没配置 AI 密钥："
echo "    nano /opt/mediark/.env   # 填入密钥"
echo "    pm2 restart mediark      # 重启生效"
echo ""
