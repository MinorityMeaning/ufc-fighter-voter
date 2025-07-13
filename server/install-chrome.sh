#!/bin/bash

# Скрипт для установки Google Chrome на Linux сервере
echo "🔧 Установка Google Chrome для Selenium..."

# Определяем дистрибутив
if [ -f /etc/debian_version ]; then
    # Debian/Ubuntu
    echo "📦 Обнаружен Debian/Ubuntu"
    
    # Добавляем репозиторий Google Chrome
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
    
    # Обновляем пакеты и устанавливаем Chrome
    sudo apt-get update
    sudo apt-get install -y google-chrome-stable
    
elif [ -f /etc/redhat-release ]; then
    # CentOS/RHEL
    echo "📦 Обнаружен CentOS/RHEL"
    
    # Устанавливаем Chrome через yum
    sudo yum install -y wget
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
    sudo yum localinstall -y google-chrome-stable_current_x86_64.rpm
    
else
    echo "❌ Неподдерживаемый дистрибутив Linux"
    exit 1
fi

# Проверяем установку
if command -v google-chrome &> /dev/null; then
    echo "✅ Google Chrome успешно установлен"
    google-chrome --version
else
    echo "❌ Ошибка установки Google Chrome"
    exit 1
fi

# Устанавливаем зависимости для Selenium
echo "📦 Установка зависимостей для Selenium..."

if [ -f /etc/debian_version ]; then
    sudo apt-get install -y xvfb libgconf-2-4
elif [ -f /etc/redhat-release ]; then
    sudo yum install -y xorg-x11-server-Xvfb
fi

echo "✅ Установка завершена!"
echo "🚀 Теперь можно запускать сервер с PM2:"
echo "   pm2 start ecosystem.config.js --env production" 