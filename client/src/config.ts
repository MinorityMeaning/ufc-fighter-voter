// Конфигурация клиента
export const config = {
  // Основные настройки
  nodeEnv: import.meta.env.MODE || 'development',
  
  // API настройки
  api: {
    // Автоматическое определение URL в зависимости от хоста
    baseURL: getApiBaseURL(),
    
    // WebSocket URL
    socketURL: getSocketBaseURL(),
    
    timeout: 30000,
    retries: 3
  },
  
  // WebSocket настройки
  socket: {
    transports: ['polling', 'websocket'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    pingInterval: 30000
  },
  
  // UI настройки
  ui: {
    refreshInterval: 5000,
    maxRetries: 3,
    toastDuration: 3000
  }
};

// Функция для определения URL API
function getApiBaseURL(): string {
  const hostname = window.location.hostname;
  
  // Если localhost или 127.0.0.1, используем localhost для API
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  
  // Если voter.mardaunt.ru, используем прокси через nginx
  if (hostname === 'voter.mardaunt.ru') {
    return '/api';
  }
  
  // В остальных случаях используем текущий хост
  return `http://${hostname}:3001/api`;
}

// Функция для определения URL WebSocket
function getSocketBaseURL(): string {
  const hostname = window.location.hostname;
  
  // Если localhost или 127.0.0.1, используем localhost для WebSocket
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // Если voter.mardaunt.ru, используем относительный путь для прокси
  if (hostname === 'voter.mardaunt.ru') {
    return '/';
  }
  
  // В остальных случаях используем текущий хост
  return `http://${hostname}:3001`;
}

// Получить полный URL для API запросов
export const getApiURL = (endpoint: string): string => {
  return `${config.api.baseURL}${endpoint}`;
};

// Получить URL для WebSocket подключения
export const getSocketURL = (): string => {
  return config.api.socketURL;
};

// Проверить, работает ли приложение в development режиме
export const isDevelopment = (): boolean => {
  return config.nodeEnv === 'development';
};

// Проверить, работает ли приложение в production режиме
export const isProduction = (): boolean => {
  return config.nodeEnv === 'production';
}; 