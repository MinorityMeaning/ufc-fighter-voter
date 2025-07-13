# Инструкция по развертыванию на сервере

## Подготовка сервера

### 1. Установка зависимостей

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Устанавливаем Chrome для Selenium
sudo apt-get install -y wget gnupg
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Устанавливаем nginx
sudo apt-get install -y nginx

# Устанавливаем certbot для SSL
sudo apt-get install -y certbot python3-certbot-nginx
```

### 2. Настройка nginx

Создайте файл конфигурации nginx:

```bash
sudo nano /etc/nginx/sites-available/voter.mardaunt.ru
```

Содержимое файла:

```nginx
# HTTP server block для поддомена voter (редирект на HTTPS)
server {
    listen 80;
    server_name voter.mardaunt.ru;
    
    # Перенаправление с HTTP на HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS server block для поддомена voter
server {
    listen 443 ssl;
    server_name voter.mardaunt.ru;
    ssl_certificate /etc/letsencrypt/live/mardaunt.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mardaunt.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    location / {
        root /var/www/html/fighter-voter/client/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/voter.mardaunt.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Получение SSL сертификата

```bash
sudo certbot --nginx -d voter.mardaunt.ru
```

## Развертывание приложения

### 1. Клонирование и установка

```bash
# Клонируем репозиторий
cd /var/www/html
sudo git clone <your-repo-url> fighter-voter
cd fighter-voter

# Устанавливаем зависимости
npm run install:all
```

### 2. Настройка переменных окружения

```bash
# Настраиваем сервер
cd server
cp env.example .env
nano .env
```

Содержимое `.env`:

```env
NODE_ENV=production
PORT=3001
CLIENT_URL=https://voter.mardaunt.ru
MAX_CONNECTIONS=50000
RATE_LIMIT=1000
API_TIMEOUT=30000
PARSER_INTERVAL=30000
API_HOST=localhost
```

### 3. Сборка клиента

```bash
# Собираем клиент для продакшена
cd /var/www/html/fighter-voter
npm run build
```

### 4. Настройка systemd сервиса

Создайте файл сервиса:

```bash
sudo nano /etc/systemd/system/ufc-voter.service
```

Содержимое:

```ini
[Unit]
Description=UFC Voting Widget Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/html/fighter-voter/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/serverMemory.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Активируйте сервис:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ufc-voter
sudo systemctl start ufc-voter
```

### 5. Настройка прав доступа

```bash
# Устанавливаем правильные права
sudo chown -R www-data:www-data /var/www/html/fighter-voter
sudo chmod -R 755 /var/www/html/fighter-voter
```

## Проверка работы

### 1. Проверка сервиса

```bash
# Проверяем статус сервиса
sudo systemctl status ufc-voter

# Смотрим логи
sudo journalctl -u ufc-voter -f
```

### 2. Проверка nginx

```bash
# Проверяем статус nginx
sudo systemctl status nginx

# Тестируем конфигурацию
sudo nginx -t
```

### 3. Проверка SSL

```bash
# Проверяем SSL сертификат
sudo certbot certificates
```

## Обновление приложения

### 1. Остановка сервиса

```bash
sudo systemctl stop ufc-voter
```

### 2. Обновление кода

```bash
cd /var/www/html/fighter-voter
git pull origin main
npm run install:all
npm run build
```

### 3. Запуск сервиса

```bash
sudo systemctl start ufc-voter
sudo systemctl status ufc-voter
```

## Мониторинг

### 1. Логи сервиса

```bash
# Просмотр логов в реальном времени
sudo journalctl -u ufc-voter -f

# Просмотр последних 100 строк
sudo journalctl -u ufc-voter -n 100
```

### 2. Логи nginx

```bash
# Логи доступа
sudo tail -f /var/log/nginx/access.log

# Логи ошибок
sudo tail -f /var/log/nginx/error.log
```

### 3. Мониторинг ресурсов

```bash
# Использование памяти и CPU
htop

# Использование диска
df -h

# Сетевые соединения
netstat -tulpn | grep :3001
```

## Устранение неполадок

### 1. Сервис не запускается

```bash
# Проверяем логи
sudo journalctl -u ufc-voter -n 50

# Проверяем права доступа
ls -la /var/www/html/fighter-voter/server/

# Проверяем зависимости
cd /var/www/html/fighter-voter/server
npm list
```

### 2. Проблемы с nginx

```bash
# Проверяем конфигурацию
sudo nginx -t

# Перезапускаем nginx
sudo systemctl restart nginx

# Проверяем логи
sudo tail -f /var/log/nginx/error.log
```

### 3. Проблемы с SSL

```bash
# Обновляем сертификат
sudo certbot renew

# Проверяем статус
sudo certbot certificates
```

## Безопасность

### 1. Firewall

```bash
# Открываем только необходимые порты
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Регулярные обновления

```bash
# Автоматические обновления безопасности
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 3. Резервное копирование

```bash
# Создаем скрипт для бэкапа
sudo nano /usr/local/bin/backup-ufc-voter.sh
```

Содержимое скрипта:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/ufc-voter"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/ufc-voter-$DATE.tar.gz /var/www/html/fighter-voter
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

Делаем скрипт исполняемым:

```bash
sudo chmod +x /usr/local/bin/backup-ufc-voter.sh
```

Добавляем в cron:

```bash
sudo crontab -e
# Добавляем строку: 0 2 * * * /usr/local/bin/backup-ufc-voter.sh
``` 