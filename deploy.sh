#!/bin/bash

# Deployment Script for Telegram Inventory Bot
# Run this script on your VPS after transferring the code

set -e  # Exit on error

echo "🚀 Starting deployment of Telegram Inventory Bot..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Run: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) found"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating template..."
    cat > .env << EOF
BOT_TOKEN=your_bot_token_here
ADMINS=your_chat_id_1,your_chat_id_2
DB_PATH=./db.json
EOF
    echo "📝 Please edit .env file with your bot token and admin IDs:"
    echo "   nano .env"
    exit 1
fi

echo "✅ .env file found"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create logs directory
mkdir -p logs

# Create backups directory
mkdir -p backups

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
else
    echo "✅ PM2 is already installed"
fi

# Stop existing bot if running
if pm2 list | grep -q "telegram-inventory-bot"; then
    echo "🛑 Stopping existing bot instance..."
    pm2 stop telegram-inventory-bot || true
    pm2 delete telegram-inventory-bot || true
fi

# Start bot with PM2
echo "🚀 Starting bot with PM2..."
pm2 start ecosystem.config.js || pm2 start index.js --name telegram-inventory-bot

# Save PM2 configuration
pm2 save

echo "✅ Bot started successfully!"
echo ""
echo "📊 Useful commands:"
echo "   pm2 status                  - Check bot status"
echo "   pm2 logs telegram-inventory-bot - View logs"
echo "   pm2 restart telegram-inventory-bot - Restart bot"
echo "   pm2 monit                  - Monitor resources"
echo ""
echo "🔧 Setup auto-start on reboot:"
echo "   pm2 startup"
echo "   (Then run the command it outputs)"
echo ""
echo "✨ Deployment complete!"

