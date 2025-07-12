# Быстрый деплой UFC Voting Widget

## 🚀 Быстрый старт (5 минут)

### 1. Подготовка файлов
```bash
# Соберите проект
npm run install:all
npm run build
```

### 2. Настройка доменов
```bash
# Сервер
cd server
cp env.example .env
# Отредактируйте .env - замените yourdomain.com на ваш домен

# Клиент  
cd ../client
cp env.example .env
# Отредактируйте .env - замените yourdomain.com на ваш домен
```

### 3. Загрузка на сервер
```bash
# Загрузите файлы
scp -r ./fighter-voter user@your-server:/var/www/

# Подключитесь к серверу
ssh user@your-server
cd /var/www/fighter-voter
```

### 4. Запуск
```bash
# Установите зависимости
npm run install:all

# Создайте PM2 конфигурацию
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

# Запустите
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Настройка Nginx (опционально)
```bash
# Установите Nginx
sudo apt install nginx

# Создайте конфигурацию
sudo nano /etc/nginx/sites-available/ufc-voting
```

Содержимое:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        root /var/www/fighter-voter/client/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
# Активируйте
sudo ln -s /etc/nginx/sites-available/ufc-voting /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## ✅ Проверка
- Откройте https://yourdomain.com
- Проверьте админ панель: https://yourdomain.com/#admin-ufc-secret-panel-2024

## 🔧 Обновление
```bash
pm2 stop ufc-voting-server
git pull origin main
npm run install:all
npm run build
pm2 start ufc-voting-server
```

## 📋 Что нужно заменить
- `yourdomain.com` → ваш реальный домен
- `user@your-server` → ваши данные для подключения к серверу
- `/var/www/fighter-voter` → путь на вашем сервере

## 🆘 Если что-то не работает
```bash
# Проверьте логи
pm2 logs ufc-voting-server

# Проверьте статус
pm2 status

# Проверьте API
curl http://localhost:3001/api/health
``` 