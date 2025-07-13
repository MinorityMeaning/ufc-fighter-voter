# Сводка изменений для развертывания на сервере

## ✅ Исправленные проблемы с хостами

### 1. Клиентские файлы
- **`client/src/utils/api.ts`**: Убрал хардкод IP `192.168.0.14`, теперь использует `localhost` для development
- **`client/src/hooks/useSocket.ts`**: Убрал хардкод IP `192.168.0.14`, теперь использует `localhost` для development
- **`client/src/config.ts`**: Переписал логику для автоматического определения URL в зависимости от хоста

### 2. Серверные файлы
- **`server/config.js`**: Убрал хардкод IP `192.168.0.14`, обновил production домены на `voter.mardaunt.ru`
- **`server/src/serverMemory.js`**: Убрал хардкод IP в логах, теперь показывает `localhost`

### 3. Selenium парсер
- **`server/src/webParserSelenium.js`**: Добавил `--headless` режим для работы на серверах без видеокарты

## 🔧 Настройка для сервера

### Переменные окружения
Создан файл `server/env.example` с правильными настройками для production:

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

### Nginx конфигурация
Подготовлена конфигурация nginx для `voter.mardaunt.ru` с:
- Редиректом HTTP → HTTPS
- Проксированием `/api/` на `localhost:3001/api/`
- Проксированием `/socket.io/` на `localhost:3001/socket.io/`
- Обслуживанием статических файлов из `client/dist/`

## 🚀 Автоматическое определение URL

### Логика работы:
1. **Development (localhost/127.0.0.1)**: 
   - API: `http://localhost:3001/api`
   - WebSocket: `http://localhost:3001`

2. **Production (voter.mardaunt.ru)**:
   - API: `/api` (прокси через nginx)
   - WebSocket: `/` (прокси через nginx)

3. **Другие хосты**:
   - API: `http://{hostname}:3001/api`
   - WebSocket: `http://{hostname}:3001`

## 📋 Чек-лист для развертывания

### На сервере:
1. ✅ Установить Node.js 18+
2. ✅ Установить Chrome для Selenium
3. ✅ Установить nginx
4. ✅ Настроить nginx конфигурацию
5. ✅ Получить SSL сертификат
6. ✅ Клонировать репозиторий
7. ✅ Установить зависимости: `npm run install:all`
8. ✅ Настроить `.env` файл
9. ✅ Собрать клиент: `npm run build`
10. ✅ Настроить systemd сервис
11. ✅ Запустить сервис

### Проверка:
- ✅ Сервис запущен: `sudo systemctl status ufc-voter`
- ✅ Nginx работает: `sudo systemctl status nginx`
- ✅ SSL активен: `sudo certbot certificates`
- ✅ Сайт доступен: https://voter.mardaunt.ru
- ✅ API работает: https://voter.mardaunt.ru/api/memory/current
- ✅ WebSocket работает: подключение через браузер

## 🔍 Мониторинг

### Логи:
- Сервис: `sudo journalctl -u ufc-voter -f`
- Nginx: `sudo tail -f /var/log/nginx/error.log`

### Статус:
- Сервис: `sudo systemctl status ufc-voter`
- Nginx: `sudo systemctl status nginx`
- Порт: `netstat -tulpn | grep :3001`

## 🛠️ Обновление

```bash
# Остановить сервис
sudo systemctl stop ufc-voter

# Обновить код
cd /var/www/html/fighter-voter
git pull origin main
npm run install:all
npm run build

# Запустить сервис
sudo systemctl start ufc-voter
sudo systemctl status ufc-voter
```

## ⚠️ Важные моменты

1. **Selenium в headless режиме**: Работает без видеокарты
2. **Автоматическое определение URL**: Не требует изменения кода при смене домена
3. **Прокси через nginx**: API и WebSocket работают через один домен
4. **SSL сертификат**: Автоматическое обновление через certbot
5. **Systemd сервис**: Автозапуск при перезагрузке сервера

## 📞 Поддержка

При проблемах проверьте:
1. Логи сервиса: `sudo journalctl -u ufc-voter -n 100`
2. Логи nginx: `sudo tail -f /var/log/nginx/error.log`
3. Статус сервисов: `sudo systemctl status ufc-voter nginx`
4. Сетевые соединения: `netstat -tulpn | grep :3001` 