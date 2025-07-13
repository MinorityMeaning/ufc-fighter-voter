// Конфигурация сервера
export const config = {
  // Основные настройки
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Домены и CORS
  domains: {
    development: [
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ],
    production: [
      'https://voter.mardaunt.ru'
    ]
  },
  
  // WebSocket настройки
  socket: {
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxConnections: process.env.MAX_CONNECTIONS || 50000
  },
  
  // API настройки
  api: {
    rateLimit: process.env.RATE_LIMIT || 1000,
    timeout: process.env.API_TIMEOUT || 30000
  },
  
  // Парсер настройки
  parser: {
    checkInterval: process.env.PARSER_INTERVAL || 30000,
    configFile: 'ufc-parser-config.json'
  }
};

// Получить разрешенные домены для CORS
export const getCorsOrigins = () => {
  return config.domains[config.nodeEnv] || config.domains.development;
};

// Получить базовый URL для клиента
export const getClientBaseURL = () => {
  const origins = getCorsOrigins();
  return origins[0]; // Возвращаем первый домен как основной
};

// Получить базовый URL для API
export const getApiBaseURL = () => {
  const hostname = process.env.API_HOST || 'localhost';
  const port = config.port;
  const protocol = config.nodeEnv === 'production' ? 'https' : 'http';
  
  return `${protocol}://${hostname}:${port}`;
}; 