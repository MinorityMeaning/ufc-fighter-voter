# Инструкция по деплою UFC Voting Widget

## Подготовка к деплою

### 1. Настройка переменных окружения

**Сервер (server/.env):**
```bash
# Основные настройки
NODE_ENV=production
PORT=3001

# Домены (ОБЯЗАТЕЛЬНО замените на ваши!)
CLIENT_URL=https://yourdomain.com
ADMIN_URL=https://admin.yourdomain.com
API_HOST=api.yourdomain.com

# WebSocket настройки
MAX_CONNECTIONS=50000

# API настройки
RATE_LIMIT=1000
API_TIMEOUT=30000

# Парсер настройки
PARSER_INTERVAL=30000
```

**Клиент (client/.env):**
```bash
# API URL для production
VITE_API_URL=https://api.yourdomain.com/api

# WebSocket URL для production  
VITE_SOCKET_URL=https://api.yourdomain.com
```

### 2. Сборка проекта

```bash
# Установка зависимостей
npm run install:all

# Сборка клиента
npm run build
```

## Деплой на сервер

### Вариант A: Простой деплой с PM2

1. **Загрузите файлы на сервер:**
```bash
scp -r ./fighter-voter user@your-server:/var/www/
```

2. **Подключитесь к серверу:**
```bash
ssh user@your-server
cd /var/www/fighter-voter
```

3. **Установите зависимости:**
```bash
npm run install:all
```

4. **Настройте переменные окружения:**
```bash
cd server && cp env.example .env
# Отредактируйте .env с вашими доменами
cd ../client && cp env.example .env
# Отредактируйте .env с вашими доменами
cd ..
```

5. **Соберите клиент:**
```bash
npm run build
```

6. **Создайте PM2 конфигурацию:**
```bash
# Создайте файл ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'ufc-voting-server',
    script: './server/src/serverMemory.js',
    cwd: '/var/www/fighter-voter',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
EOF
```

7. **Запустите приложение:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Вариант B: Деплой с Nginx

1. **Выполните шаги 1-7 из Варианта A**

2. **Установите Nginx:**
```bash
sudo apt update
sudo apt install nginx
```

3. **Создайте конфигурацию Nginx:**
```bash
sudo nano /etc/nginx/sites-available/ufc-voting
```

Содержимое файла:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL сертификаты (настройте свои)
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # Статические файлы клиента
    location / {
        root /var/www/fighter-voter/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Кэширование статических файлов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API проксирование
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket проксирование
    location /socket.io/ {
        proxy_pass http://localhost:3001;
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

4. **Активируйте конфигурацию:**
```bash
sudo ln -s /etc/nginx/sites-available/ufc-voting /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

5. **Настройте SSL (Let's Encrypt):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Вариант C: Docker деплой

1. **Создайте Dockerfile:**
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Копируем package.json файлы
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Устанавливаем зависимости
RUN npm run install:all

# Копируем исходный код
COPY . .

# Собираем клиент
RUN npm run build

# Открываем порт
EXPOSE 3001

# Запускаем сервер
CMD ["npm", "start"]
```

2. **Создайте docker-compose.yml:**
```yaml
version: '3.8'
services:
  ufc-voting:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - CLIENT_URL=https://yourdomain.com
      - ADMIN_URL=https://admin.yourdomain.com
      - API_HOST=api.yourdomain.com
    restart: unless-stopped
```

3. **Запустите:**
```bash
docker-compose up -d
```

## Проверка деплоя

### 1. Проверка сервера
```bash
# Проверка статуса PM2
pm2 status

# Просмотр логов
pm2 logs ufc-voting-server

# Проверка API
curl https://yourdomain.com/api/health
```

### 2. Проверка клиента
- Откройте https://yourdomain.com в браузере
- Проверьте админ панель: https://yourdomain.com/#admin-ufc-secret-panel-2024

### 3. Проверка WebSocket
```bash
# В консоли браузера
const socket = io('https://yourdomain.com');
socket.on('connect', () => console.log('Connected!'));
```

## Обновление приложения

### 1. Остановка
```bash
pm2 stop ufc-voting-server
```

### 2. Обновление кода
```bash
git pull origin main
npm run install:all
npm run build
```

### 3. Обновление переменных окружения (если нужно)
```bash
# Отредактируйте .env файлы
nano server/.env
nano client/.env
```

### 4. Запуск
```bash
pm2 start ufc-voting-server
```

## Мониторинг

### 1. Логи
```bash
# PM2 логи
pm2 logs ufc-voting-server

# Nginx логи
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 2. Мониторинг ресурсов
```bash
pm2 monit
htop
```

### 3. Статистика API
```bash
curl https://yourdomain.com/api/stats
```

## Устранение неполадок

### 1. Сервер не запускается
```bash
# Проверьте логи
pm2 logs ufc-voting-server

# Проверьте переменные окружения
cat server/.env

# Проверьте порт
netstat -tlnp | grep 3001
```

### 2. WebSocket не работает
```bash
# Проверьте CORS настройки
curl -H "Origin: https://yourdomain.com" https://yourdomain.com/api/health

# Проверьте Nginx конфигурацию
sudo nginx -t
```

### 3. Клиент не загружается
```bash
# Проверьте сборку
ls -la client/dist/

# Проверьте Nginx конфигурацию
sudo nginx -t
```

## Безопасность

### 1. Файрвол
```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable
```

### 2. SSL сертификаты
```bash
# Автоматическое обновление
sudo crontab -e
# Добавьте: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Регулярные обновления
```bash
# Обновление системы
sudo apt update && sudo apt upgrade

# Обновление PM2
pm2 update
``` 