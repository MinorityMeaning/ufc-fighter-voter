# 🚀 Развертывание UFC Voting Server на сервере

## 📋 Требования

- Linux сервер (Ubuntu/Debian/CentOS)
- Node.js 18+
- PM2
- Google Chrome (для Selenium)

## 🔧 Установка на сервере

### 1. Клонирование и установка зависимостей

```bash
# Клонируем репозиторий
git clone <your-repo-url>
cd fighter-voter

# Устанавливаем зависимости
npm install
cd server && npm install
```

### 2. Установка Chrome для Selenium

```bash
# Делаем скрипт исполняемым
chmod +x server/install-chrome.sh

# Запускаем установку Chrome
./server/install-chrome.sh
```

### 3. Создание директории для логов

```bash
mkdir -p server/logs
```

### 4. Настройка переменных окружения

Создайте файл `.env` в папке `server/`:

```bash
# Server
NODE_ENV=production
PORT=3001
HOST=voter.mardaunt.ru

# Chrome/Selenium
CHROME_HEADLESS=true
CHROME_NO_SANDBOX=true
CHROME_DISABLE_DEV_SHM=true
CHROME_DISABLE_GPU=true
```

### 5. Запуск с PM2

```bash
# Останавливаем старый процесс (если есть)
pm2 stop ufc-voiting-server
pm2 delete ufc-voiting-server

# Запускаем новый процесс
cd server
pm2 start ecosystem.config.cjs --env production

# Сохраняем PM2 конфигурацию
pm2 save
pm2 startup
```

## 🔍 Проверка работы

### Проверка статуса PM2
```bash
pm2 status
pm2 logs ufc-voiting-server --lines 20
```

### Проверка логов
```bash
# Основные логи
pm2 logs ufc-voiting-server

# Только ошибки
pm2 logs ufc-voiting-server --err

# Файлы логов
tail -f server/logs/out.log
tail -f server/logs/error.log
```

### Проверка API
```bash
curl http://localhost:3001/api/status
curl http://voter.mardaunt.ru/api/status
```

## 🛠️ Управление

### Перезапуск сервера
```bash
pm2 restart ufc-voiting-server
```

### Обновление кода
```bash
# Останавливаем сервер
pm2 stop ufc-voiting-server

# Обновляем код
git pull

# Устанавливаем новые зависимости (если есть)
npm install
cd server && npm install

# Запускаем сервер
pm2 start ecosystem.config.cjs --env production
```

### Просмотр мониторинга
```bash
pm2 monit
```

## 🐛 Диагностика проблем

### Если Chrome не запускается
```bash
# Проверяем установку Chrome
google-chrome --version

# Проверяем права доступа
ls -la /usr/bin/google-chrome

# Тестируем Chrome в headless режиме
google-chrome --headless --no-sandbox --disable-dev-shm-usage --version
```

### Если Selenium не работает
```bash
# Проверяем логи PM2
pm2 logs ufc-voiting-server --err

# Проверяем файлы логов
tail -f server/logs/error.log

# Проверяем переменные окружения
pm2 env ufc-voiting-server
```

### Если сервер не отвечает
```bash
# Проверяем порт
netstat -tlnp | grep 3001

# Проверяем процессы
ps aux | grep node

# Проверяем PM2 статус
pm2 status
```

## 📊 Мониторинг

### Автоматический мониторинг
```bash
# Настройка автоперезапуска
pm2 startup
pm2 save

# Мониторинг в реальном времени
pm2 monit
```

### Логирование
- Основные логи: `server/logs/out.log`
- Ошибки: `server/logs/error.log`
- Комбинированные: `server/logs/combined.log`

## 🔒 Безопасность

### Firewall
```bash
# Открываем только нужные порты
sudo ufw allow 3001
sudo ufw allow 80
sudo ufw allow 443
```

### Nginx (если используется)
```nginx
server {
    listen 80;
    server_name voter.mardaunt.ru;
    
    location / {
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
}
``` 