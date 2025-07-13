// Упрощенный UFC сервер без базы данных
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

// Наши модули
import { memoryStorage } from './memoryStorage.js';
import { externalAPI } from './externalAPI.js';
import memoryVotesRouter from './routes/memoryVotes.js';
import { config, getCorsOrigins } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// CORS настройки
const io = new Server(server, {
  cors: {
    origin: getCorsOrigins(),
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Оптимизации для большого количества подключений
  transports: config.socket.transports,
  pingTimeout: config.socket.pingTimeout,
  pingInterval: config.socket.pingInterval
});

// Middleware
app.use(helmet());
app.use(compression());

app.use(cors({
  origin: getCorsOrigins(),
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Глобальный доступ к Socket.io и externalAPI
global.socketIO = io;
global.externalAPI = externalAPI;

// === API ROUTES ===

// Memory-based routes
app.use('/api/memory', memoryVotesRouter);

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  const serverStats = memoryStorage.getServerStats();
  const currentState = memoryStorage.getCurrentState();
  const apiStatus = externalAPI.getStatus();
  
  res.json({
    status: 'healthy',
    uptime: serverStats.uptime,
    memory: serverStats.memory,
    currentFight: currentState.fight ? 
      `${currentState.fight.fighter1_name} vs ${currentState.fight.fighter2_name}` : 
      'Нет активного боя',
    totalVotes: currentState.votes.total,
    activeConnections: serverStats.activeConnections,
    externalAPI: apiStatus,
    timestamp: new Date().toISOString()
  });
});

// Статистика API
app.get('/api/stats', (req, res) => {
  const serverStats = memoryStorage.getServerStats();
  const currentState = memoryStorage.getCurrentState();
  const voteStats = memoryStorage.getVoteStats();
  
  res.json({
    server: serverStats,
    game: currentState,
    votes: voteStats,
    history: memoryStorage.getFightHistory(5)
  });
});

// Админские эндпоинты перенесены в memoryVotes.js

// === SOCKET.IO SETUP ===

// Статистика подключений
let connectionCount = 0;
const MAX_CONNECTIONS = config.socket.maxConnections;

io.on('connection', (socket) => {
  connectionCount++;
  
  // Проверка лимита подключений
  if (connectionCount > MAX_CONNECTIONS) {
    console.log(`❌ Превышен лимит подключений: ${connectionCount}/${MAX_CONNECTIONS}`);
    socket.emit('error', { 
      message: 'Сервер перегружен. Попробуйте позже.' 
    });
    socket.disconnect();
    connectionCount--;
    return;
  }

  console.log(`👤 Пользователь подключился: ${socket.id} (всего: ${connectionCount})`);

  // Отправляем текущее состояние при подключении
  const currentState = memoryStorage.getCurrentState();
  const voteStats = memoryStorage.getVoteStats();
  
  socket.emit('current_state', {
    fight: currentState.fight,
    votes: {
      fighter1: voteStats.fighter1_votes,
      fighter2: voteStats.fighter2_votes,
      total: voteStats.total_votes
    },
    isActive: currentState.isActive,
    lastUpdate: currentState.lastUpdate
  });

  // Подписка на обновления конкретного боя
  socket.on('subscribe_to_fight', (fightId) => {
    const currentState = memoryStorage.getCurrentState();
    
    if (currentState.fight && currentState.fight.id === fightId) {
      socket.join(`fight_${fightId}`);
      console.log(`📺 Пользователь ${socket.id} подписался на бой ${fightId}`);
      
      // Отправляем текущие данные
      socket.emit('fight_data', currentState.fight);
      const voteStats = memoryStorage.getVoteStats();
      socket.emit('vote_results', {
        fight_id: fightId,
        results: {
          fighter1: voteStats.fighter1_votes,
          fighter2: voteStats.fighter2_votes,
          total: voteStats.total_votes
        }
      });
    } else {
      socket.emit('error', { message: 'Бой не найден или не активен' });
    }
  });

  // Отписка от обновлений боя
  socket.on('unsubscribe_from_fight', (fightId) => {
    socket.leave(`fight_${fightId}`);
    console.log(`📺 Пользователь ${socket.id} отписался от боя ${fightId}`);
  });

  // Админские подписки
  socket.on('subscribe_admin', () => {
    socket.join('admin');
    console.log(`👨‍💼 Администратор ${socket.id} подключился`);
    
    // Отправляем полную статистику
    socket.emit('admin_stats', {
      server: memoryStorage.getServerStats(),
      game: memoryStorage.getCurrentState(),
      history: memoryStorage.getFightHistory(),
      connections: connectionCount,
      externalAPI: externalAPI.getStatus()
    });
  });

  socket.on('unsubscribe_admin', () => {
    socket.leave('admin');
    console.log(`👨‍💼 Администратор ${socket.id} отключился`);
  });

  // Обработка голосования
  socket.on('vote', async (data) => {
    try {
      const { fight_id, fighter_choice, user_session } = data;
      
      console.log(`🗳️ Голос от ${socket.id}: бой ${fight_id}, боец ${fighter_choice}`);
      
      // Валидация
      if (!fighter_choice || !user_session) {
        socket.emit('error', { message: 'Неверные данные голоса' });
        return;
      }

      if (![1, 2].includes(fighter_choice)) {
        socket.emit('error', { message: 'fighter_choice должен быть 1 или 2' });
        return;
      }

      // Получаем IP адрес
      const ip_address = socket.handshake.address || '127.0.0.1';

      // Добавляем голос через memory storage
      const result = memoryStorage.addVote(user_session, fighter_choice, ip_address);
      const voteStats = memoryStorage.getVoteStats();
      const currentState = memoryStorage.getCurrentState();
      
      console.log(`✅ Голос добавлен: ${currentState.fight?.fighter1_name} vs ${currentState.fight?.fighter2_name} (всего: ${voteStats.total_votes})`);
      
      // Отправляем обновление всем клиентам
      io.emit('vote_added', {
        fight_id: currentState.fight?.id,
        results: {
          fighter1: voteStats.fighter1_votes,
          fighter2: voteStats.fighter2_votes,
          total: voteStats.total_votes
        },
        fight: currentState.fight
      });
      
      // Подтверждаем голос отправителю
      socket.emit('vote_confirmed', {
        success: true,
        fighter_choice,
        results: {
          fighter1: voteStats.fighter1_votes,
          fighter2: voteStats.fighter2_votes,
          total: voteStats.total_votes
        }
      });
      
    } catch (error) {
      console.error(`❌ Ошибка обработки голоса от ${socket.id}:`, error);
      
      if (error.message === 'Пользователь уже голосовал в этом бою') {
        socket.emit('error', { message: 'Вы уже голосовали в этом бою' });
      } else if (error.message === 'Нет активного боя для голосования') {
        socket.emit('error', { message: 'Нет активного боя для голосования' });
      } else {
        socket.emit('error', { message: 'Ошибка сервера при обработке голоса' });
      }
    }
  });

  // Пинг-понг для поддержания соединения
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Обработка отключения
  socket.on('disconnect', (reason) => {
    connectionCount--;
    console.log(`👤 Пользователь отключился: ${socket.id}, причина: ${reason} (осталось: ${connectionCount})`);
  });

  // Обработка ошибок
  socket.on('error', (error) => {
    console.error(`❌ Ошибка сокета ${socket.id}:`, error);
  });
});

// Функции для broadcast обновлений (оптимизировано для CPU)
io.broadcastVoteUpdate = (() => {
  let lastBroadcast = 0;
  const THROTTLE_MS = 100; // максимум 10 обновлений/сек
  
  return (data) => {
    const now = Date.now();
    
    // Throttling для снижения CPU нагрузки
    if (now - lastBroadcast < THROTTLE_MS) {
      return;
    }
    lastBroadcast = now;
    
    const { fight_id, results } = data;
    console.log(`📊 Отправка обновления голосов для боя ${fight_id} (${connectionCount} подключений)`);
    
    // Отправляем ТОЛЬКО всем (убираем дублирование)
    io.emit('vote_update', data);
    
    // Админам отправляем отдельно с дополнительной статистикой
    io.to('admin').emit('admin_vote_update', {
      ...data,
      connectionCount,
      timestamp: now
    });
  };
})();

io.broadcastNewFight = (fight) => {
  console.log(`🔥 Новый бой начался: ${fight.fighter1_name} vs ${fight.fighter2_name}`);
  
  // Отправляем всем
  const voteStats = memoryStorage.getVoteStats();
  io.emit('new_fight_started', {
    fight,
    votes: {
      fighter1: voteStats.fighter1_votes,
      fighter2: voteStats.fighter2_votes,
      total: voteStats.total_votes
    },
    message: `Новый бой: ${fight.fighter1_name} vs ${fight.fighter2_name}!`
  });
  
  // Отправляем админам
  io.to('admin').emit('new_fight_started', { fight });
};

// Периодическая отправка статистики админам
setInterval(() => {
  const adminRoom = io.sockets.adapter.rooms.get('admin');
  if (adminRoom && adminRoom.size > 0) {
    io.to('admin').emit('connection_stats', {
      total: connectionCount,
      admin: adminRoom.size,
      regular: connectionCount - adminRoom.size,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  }
}, 30000); // каждые 30 секунд

// === ИНИЦИАЛИЗАЦИЯ И ЗАПУСК ===

const PORT = config.port;

async function startServer() {
  try {
    console.log('🚀 Запуск UFC сервера без БД...');
    
    // Восстанавливаем состояние из backup (если есть)
    const restored = await memoryStorage.restoreFromFile();
    if (restored) {
      console.log('📥 Состояние восстановлено из backup');
    }
    
    // Запускаем мониторинг внешнего API
    externalAPI.startMonitoring();
    console.log('🔍 Мониторинг внешнего API запущен');
    
    // Запускаем сервер на всех интерфейсах
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Сервер запущен на порту ${PORT} (все интерфейсы)`);
      console.log(`📡 Socket.io готов к подключениям (макс: ${MAX_CONNECTIONS})`);
      console.log(`💾 In-memory storage инициализирован`);
      console.log(`🔄 Backup каждые 5 минут`);
      console.log(`🔍 Проверка новых боев каждые 10 минут`);
      console.log(`🌐 Доступ из локальной сети: http://localhost:${PORT}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Получен сигнал остановки...');
  
  try {
    // Сохраняем состояние
    await memoryStorage.backupToFile();
    console.log('💾 Состояние сохранено в backup');
    
    // Останавливаем сервер
    server.close(() => {
      console.log('✅ Сервер остановлен');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Ошибка при остановке:', error);
    process.exit(1);
  }
});

// Обработка unhandled errors
process.on('uncaughtException', (error) => {
  console.error('❌ Неперехваченная ошибка:', error);
  // Не выходим сразу, пытаемся сохранить состояние
  memoryStorage.backupToFile().finally(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Неперехваченное отклонение promise:', error);
});

startServer(); 