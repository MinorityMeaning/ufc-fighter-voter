module.exports = {
  apps: [{
    name: 'ufc-voiting-server',
    script: './src/serverMemory.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    // Настройки для Selenium/Chrome
    env_selenium: {
      NODE_ENV: 'production',
      PORT: 3001,
      CHROME_HEADLESS: 'true',
      CHROME_NO_SANDBOX: 'true',
      CHROME_DISABLE_DEV_SHM: 'true'
    },
    // Логирование
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Автоперезапуск при ошибках
    max_restarts: 10,
    min_uptime: '10s',
    // Настройки для работы с Chrome/Selenium
    kill_timeout: 5000,
    listen_timeout: 8000,
    // Переменные окружения для Chrome
    env_chrome: {
      CHROME_BIN: '/usr/bin/google-chrome',
      CHROME_HEADLESS: 'true',
      CHROME_NO_SANDBOX: 'true',
      CHROME_DISABLE_DEV_SHM: 'true',
      CHROME_DISABLE_GPU: 'true',
      CHROME_DISABLE_WEB_SECURITY: 'true',
      CHROME_DISABLE_FEATURES: 'VizDisplayCompositor'
    }
  }]
}; 