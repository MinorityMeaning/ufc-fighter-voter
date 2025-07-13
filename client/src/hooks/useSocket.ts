import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { UseSocketReturn } from '../types';

// Автоопределение URL для подключения
const getSocketURL = () => {
  const hostname = window.location.hostname;
  
  // Для localhost используем прямой URL (Vite прокси не работает для WebSocket)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // Если voter.mardaunt.ru, используем относительный путь для прокси
  if (hostname === 'voter.mardaunt.ru') {
    return '/'; // Используем относительный путь для прокси через nginx
  }
  
  // В остальных случаях используем относительный путь
  return '/';
};

const SOCKET_URL = getSocketURL();

export const useSocket = (): UseSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    try {
      console.log('🔌 Подключение к WebSocket:', SOCKET_URL);
      const socket = io(SOCKET_URL, {
        query: { v: Date.now() }, // Принудительно обновляем кэш
        path: '/socket.io/', // Добавляем путь для прокси
        transports: ['polling', 'websocket'], // Polling первым для мобильных
        reconnection: true,
        reconnectionAttempts: 10, // Больше попыток
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000, // Меньше timeout для быстрого фидбека
        forceNew: true, // Принудительно новое соединение
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ WebSocket подключен успешно');
        setIsConnected(true);
        setError(null);
      });

      socket.on('disconnect', (reason) => {
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // Сервер инициировал отключение, переподключаемся
          socket.connect();
        }
      });

      socket.on('connect_error', (err) => {
        console.error('❌ WebSocket ошибка подключения:', err);
        setError(`Ошибка подключения: ${err.message}`);
        setIsConnected(false);
      });

      socket.on('error', (err) => {
        setError(`Ошибка сокета: ${err.message || 'Неизвестная ошибка'}`);
      });

      // Пинг для поддержания соединения
      const pingInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
        }
      }, 30000);

      socket.on('pong', () => {
        // Соединение активно
      });

      // Очистка интервала при отключении
      socket.on('disconnect', () => {
        clearInterval(pingInterval);
      });

    } catch (err) {
      setError('Не удалось создать соединение');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event: string, ...args: any[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, ...args);
    }
  }, []);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Автопереподключение при потере соединения
  useEffect(() => {
    if (!isConnected && !error) {
      const reconnectTimer = setTimeout(() => {
        if (!socketRef.current?.connected) {
          connect();
        }
      }, 3000);

      return () => clearTimeout(reconnectTimer);
    }
  }, [isConnected, error, connect]);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    emit,
    on,
    off,
  };
}; 