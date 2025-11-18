# Deployment Guide for VPS (Terminal Only)

This guide will help you deploy the Telegram Inventory Bot to a VPS using only terminal access.

## Prerequisites

1. A VPS with Ubuntu/Debian (or similar Linux distribution)
2. SSH access to your VPS
3. Your Telegram Bot Token from [@BotFather](https://t.me/BotFather)

## Step 1: Connect to Your VPS

```bash
ssh username@your-vps-ip
```

## Step 2: Install Node.js and npm

### For Ubuntu/Debian:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### For CentOS/RHEL:

```bash
# Update system packages
sudo yum update -y

# Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 3: Transfer Your Code to VPS

### Option A: Using Git (Recommended)

```bash
# On your VPS, clone your repository
cd ~
git clone https://github.com/yourusername/telegram_inventory_bot.git
# OR if you have a private repo:
# git clone git@github.com:yourusername/telegram_inventory_bot.git

cd telegram_inventory_bot
```

### Option B: Using SCP from Your Local Machine

From your local machine terminal:

```bash
# Compress the project (excluding node_modules)
tar -czf bot.tar.gz --exclude='node_modules' --exclude='db.json' --exclude='.git' telegram_inventory_bot/

# Transfer to VPS
scp bot.tar.gz username@your-vps-ip:~/

# On VPS, extract
ssh username@your-vps-ip
cd ~
tar -xzf bot.tar.gz
cd telegram_inventory_bot
```

### Option C: Using rsync from Your Local Machine

```bash
rsync -avz --exclude 'node_modules' --exclude 'db.json' --exclude '.git' ./telegram_inventory_bot/ username@your-vps-ip:~/telegram_inventory_bot/
```

## Step 4: Install Dependencies

```bash
cd ~/telegram_inventory_bot  # or your project path
npm install
```

## Step 5: Create Environment File

```bash
# Create .env file
nano .env
```

Add the following content:

```env
BOT_TOKEN=your_bot_token_here
ADMINS=your_chat_id_1,your_chat_id_2
DB_PATH=./db.json
```

Save and exit (Ctrl+X, then Y, then Enter).

## Step 6: Install PM2 (Process Manager)

PM2 will keep your bot running and restart it automatically if it crashes.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

## Step 7: Start the Bot with PM2

```bash
cd ~/telegram_inventory_bot

# Start the bot
pm2 start index.js --name telegram-inventory-bot

# Save PM2 configuration to auto-start on reboot
pm2 save
pm2 startup

# The last command will output a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username
# Copy and run that command
```

## Step 8: Monitor Your Bot

```bash
# View bot status
pm2 status

# View logs
pm2 logs telegram-inventory-bot

# View real-time logs
pm2 logs telegram-inventory-bot --lines 50

# Restart bot
pm2 restart telegram-inventory-bot

# Stop bot
pm2 stop telegram-inventory-bot

# Delete bot from PM2
pm2 delete telegram-inventory-bot
```

## Alternative: Using systemd (Instead of PM2)

If you prefer systemd:

### 1. Create systemd service file:

```bash
sudo nano /etc/systemd/system/telegram-inventory-bot.service
```

Add the following content (adjust paths and username):

```ini
[Unit]
Description=Telegram Inventory Bot
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/telegram_inventory_bot
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=telegram-inventory-bot

[Install]
WantedBy=multi-user.target
```

### 2. Enable and start the service:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable telegram-inventory-bot

# Start the service
sudo systemctl start telegram-inventory-bot

# Check status
sudo systemctl status telegram-inventory-bot

# View logs
sudo journalctl -u telegram-inventory-bot -f
```

## Useful Commands

### PM2 Commands:
```bash
pm2 status                      # Check status
pm2 logs telegram-inventory-bot # View logs
pm2 restart telegram-inventory-bot  # Restart bot
pm2 stop telegram-inventory-bot     # Stop bot
pm2 monit                       # Monitor resources
```

### systemd Commands:
```bash
sudo systemctl status telegram-inventory-bot  # Check status
sudo systemctl restart telegram-inventory-bot # Restart
sudo systemctl stop telegram-inventory-bot    # Stop
sudo systemctl start telegram-inventory-bot   # Start
sudo journalctl -u telegram-inventory-bot -n 100  # View last 100 log lines
```

## Updating Your Bot

When you need to update the bot:

```bash
cd ~/telegram_inventory_bot

# If using Git:
git pull origin main  # or your branch name

# Reinstall dependencies if package.json changed
npm install

# Restart the bot
pm2 restart telegram-inventory-bot
# OR
sudo systemctl restart telegram-inventory-bot
```

## Troubleshooting

### Bot is not starting:
```bash
# Check logs
pm2 logs telegram-inventory-bot
# OR
sudo journalctl -u telegram-inventory-bot -n 50

# Check if .env file exists and has correct values
cat .env

# Test manually
node index.js
```

### Bot keeps crashing:
```bash
# Check error logs
pm2 logs telegram-inventory-bot --err

# Check system resources
pm2 monit
# OR
htop
```

### Permission issues:
```bash
# Make sure you own the directory
sudo chown -R $USER:$USER ~/telegram_inventory_bot

# Check file permissions
ls -la ~/telegram_inventory_bot
```

## Security Best Practices

1. **Firewall**: Configure UFW (if using Ubuntu):
   ```bash
   sudo ufw allow 22/tcp  # SSH
   sudo ufw enable
   ```

2. **Keep system updated**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Protect .env file**:
   ```bash
   chmod 600 .env  # Only owner can read/write
   ```

4. **Use a non-root user** for running the bot

5. **Regular backups** of `db.json`:
   ```bash
   # Create backup script
   echo '#!/bin/bash
   cp ~/telegram_inventory_bot/db.json ~/telegram_inventory_bot/backups/db_$(date +%Y%m%d_%H%M%S).json' > ~/backup-bot.sh
   
   chmod +x ~/backup-bot.sh
   
   # Add to crontab for daily backups
   crontab -e
   # Add: 0 2 * * * /home/your-username/backup-bot.sh
   ```

## Backup Database

Create a backup directory and script:

```bash
mkdir -p ~/telegram_inventory_bot/backups
cd ~/telegram_inventory_bot

# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="backups"
mkdir -p $BACKUP_DIR
cp db.json "$BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).json"
# Keep only last 30 backups
ls -t $BACKUP_DIR/db_*.json | tail -n +31 | xargs -r rm
EOF

chmod +x backup.sh

# Test it
./backup.sh
```

## Quick Reference Checklist

- [ ] VPS has Node.js 18+ installed
- [ ] Code transferred to VPS
- [ ] `npm install` completed successfully
- [ ] `.env` file created with BOT_TOKEN and ADMINS
- [ ] PM2 or systemd service configured
- [ ] Bot starts successfully
- [ ] Bot auto-restarts on reboot
- [ ] Logs are accessible
- [ ] Backup system in place

## Need Help?

If you encounter issues:
1. Check the logs first
2. Verify your `.env` file has correct values
3. Make sure Node.js version is 18+
4. Check file permissions
5. Verify internet connectivity on VPS

