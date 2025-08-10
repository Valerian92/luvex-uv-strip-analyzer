#!/bin/bash
echo "🚀 Deploying UV Strip Analyzer..."

# Frontend & Backend
cd /home/valerian/apps/luvex-uv-strip-analyzer
git pull origin develop

# WordPress Plugin deployen (NEU!)
echo "📦 Deploying WordPress Plugin..."
sudo cp wordpress-plugin/luvex-uvstrip-analyzer.php /opt/bitnami/wordpress/wp-content/plugins/luvex-uvstrip-analyzer/
sudo chown bitnami:daemon /opt/bitnami/wordpress/wp-content/plugins/luvex-uvstrip-analyzer/luvex-uvstrip-analyzer.php

# Backend Service restart
echo "🔄 Restarting Backend Service..."
sudo systemctl restart luvex-analyzer.service

echo "✅ UV Analyzer deployed successfully!"