// Конфигурация клиента
export const config = {
  // Основные настройки
  nodeEnv: import.meta.env.MODE || 'development',
  
  // API настройки
  api: {
    // В development используем прокси Vite, в production - прямой URL
    baseURL: import.meta.env.MODE === 'development' 
      ? '/api' 
      : import.meta.env.VITE_API_URL || 'https://api.yourdomain.com/api',
    
    // Прямой URL для WebSocket (не через прокси)
    socketURL: import.meta.env.MODE === 'development'
      ? getDevelopmentSocketURL()
      : import.meta.env.VITE_SOCKET_URL || 'https://api.yourdomain.com',
    
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

// Функция для определения URL WebSocket в development
function getDevelopmentSocketURL(): string {
  const hostname = window.location.hostname;
  
  // Если localhost, используем localhost для API
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // Если IP адрес, используем тот же IP
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