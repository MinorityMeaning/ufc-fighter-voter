// Routes для голосования с использованием in-memory storage
import express from 'express';
import { memoryStorage } from '../memoryStorage.js';
import { v4 as uuidv4 } from 'uuid';

// Импорт веб-парсера
import webParser from '../webParser.js';

const router = express.Router();

// Функция для получения io из глобального контекста
const getIO = () => {
  if (global.socketIO) {
    return global.socketIO;
  }
  return {
    emit: () => {},
    to: () => ({ emit: () => {} })
  };
};

// === ЭНДПОИНТЫ ДЛЯ ГОЛОСОВАНИЯ ===

// Получить текущее состояние голосования
router.get('/current', (req, res) => {
  try {
    const state = memoryStorage.getCurrentState();
    const voteStats = memoryStorage.getVoteStats();
    
    res.json({
      success: true,
      fight: state.fight,
      votes: voteStats,
      isActive: state.isActive,
      lastUpdate: state.lastUpdate
    });
  } catch (error) {
    console.error('Ошибка получения текущего состояния:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить статистику голосования для конкретного боя
router.get('/stats/:fightId?', (req, res) => {
  try {
    const currentState = memoryStorage.getCurrentState();
    const { fightId } = req.params;
    
    // Если указан ID боя, проверяем что он текущий
    if (fightId && currentState.fight?.id !== fightId) {
      return res.status(404).json({ 
        error: 'Бой не найден или не активен' 
      });
    }
    
    const voteStats = memoryStorage.getVoteStats();
    
    res.json({
      success: true,
      fight_id: currentState.fight?.id || null,
      ...voteStats
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Отправить голос
router.post('/', async (req, res) => {
  try {
    const { fighter_choice, user_session } = req.body;
    
    // Валидация
    if (!fighter_choice || !user_session) {
      return res.status(400).json({ 
        error: 'Обязательные поля: fighter_choice, user_session' 
      });
    }

    if (![1, 2].includes(fighter_choice)) {
      return res.status(400).json({ 
        error: 'fighter_choice должен быть 1 или 2' 
      });
    }

    // Получаем IP адрес (для дополнительной защиты от спама)
    const ip_address = req.ip || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress ||
                      '127.0.0.1';

    // Добавляем голос через memory storage
    const result = memoryStorage.addVote(user_session, fighter_choice, ip_address);
    const voteStats = memoryStorage.getVoteStats();
    const currentState = memoryStorage.getCurrentState();
    
    // Отправляем обновление всем подключенным клиентам
    getIO().emit('vote_added', {
      fight_id: currentState.fight?.id,
      results: voteStats,
      fight: currentState.fight
    });
    
    res.status(201).json({
      success: true,
      vote: {
        fighter_choice,
        user_session
      },
      results: voteStats
    });

  } catch (error) {
    if (error.message === 'Пользователь уже голосовал в этом бою') {
      return res.status(409).json({ error: error.message });
    }
    
    if (error.message === 'Нет активного боя для голосования') {
      return res.status(400).json({ error: error.message });
    }
    
    console.error('Ошибка добавления голоса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Проверить, голосовал ли пользователь
router.post('/check', (req, res) => {
  try {
    const { user_session } = req.body;
    
    if (!user_session) {
      return res.status(400).json({ 
        error: 'Обязательное поле: user_session' 
      });
    }

    const result = memoryStorage.checkUserVoted(user_session);
    const currentState = memoryStorage.getCurrentState();
    
    res.json({ 
      success: true,
      fight_id: currentState.fight?.id || null,
      hasVoted: result.hasVoted,
      fighterChoice: result.fighterChoice
    });
    
  } catch (error) {
    console.error('Ошибка проверки голоса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === ЭНДПОИНТЫ ДЛЯ АДМИНИСТРИРОВАНИЯ ===

// Получить историю боев
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = memoryStorage.getFightHistory(limit);
    
    res.json({
      success: true,
      fights: history,
      total: history.length
    });
  } catch (error) {
    console.error('Ошибка получения истории:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить статистику сервера
router.get('/server-stats', (req, res) => {
  try {
    const stats = memoryStorage.getServerStats();
    const currentState = memoryStorage.getCurrentState();
    
    res.json({
      success: true,
      server: stats,
      game: {
        currentFight: currentState.fight?.fighter1_name && currentState.fight?.fighter2_name ? 
          `${currentState.fight.fighter1_name} vs ${currentState.fight.fighter2_name}` : 
          'Нет активного боя',
        isActive: currentState.isActive,
        totalVotes: currentState.votes.total,
        activeUsers: currentState.totalUsers
      }
    });
  } catch (error) {
    console.error('Ошибка получения статистики сервера:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Принудительно завершить текущий бой (только для админов)
router.post('/end-fight', (req, res) => {
  try {
    const result = memoryStorage.endCurrentFight();
    
    if (result) {
      // Уведомляем всех клиентов о завершении боя
      getIO().emit('fight_ended', {
        message: 'Текущий бой завершен администратором',
        finalStats: memoryStorage.getVoteStats()
      });
      
      res.json({
        success: true,
        message: 'Бой успешно завершен'
      });
    } else {
      res.status(400).json({
        error: 'Нет активного боя для завершения'
      });
    }
  } catch (error) {
    console.error('Ошибка завершения боя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Очистить все голоса (только для админов) 
router.post('/reset', (req, res) => {
  try {
    const currentState = memoryStorage.getCurrentState();
    
    if (currentState.fight) {
      // Сбрасываем голоса но оставляем бой активным
      memoryStorage.gameState.votes = { fighter1: 0, fighter2: 0, total: 0 };
      memoryStorage.gameState.userSessions.clear();
      memoryStorage.gameState.lastUpdate = new Date().toISOString();
      
      // Уведомляем клиентов
      getIO().emit('votes_reset', {
        fight_id: currentState.fight.id,
        message: 'Голоса сброшены администратором',
        results: memoryStorage.getVoteStats()
      });
      
      res.json({
        success: true,
        message: 'Голоса успешно сброшены'
      });
    } else {
      res.status(400).json({
        error: 'Нет активного боя'
      });
    }
  } catch (error) {
    console.error('Ошибка сброса голосов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Backup текущего состояния
router.post('/backup', async (req, res) => {
  try {
    await memoryStorage.backupToFile();
    res.json({
      success: true,
      message: 'Backup успешно создан'
    });
  } catch (error) {
    console.error('Ошибка создания backup:', error);
    res.status(500).json({ error: 'Ошибка создания backup' });
  }
});

// === ADMIN ENDPOINTS ===

// Получить статус внешнего API
router.get('/admin/external-status', (req, res) => {
  try {
    const externalAPI = global.externalAPI;
    
    if (!externalAPI) {
      return res.status(503).json({
        error: 'External API не инициализирован'
      });
    }

    const stats = externalAPI.getStatus();
    
    res.json({
      success: true,
      lastCheck: stats.lastCheck,
      nextCheck: stats.nextCheck,
      isHealthy: stats.isHealthy,
      totalChecks: stats.totalChecks
    });
  } catch (error) {
    console.error('Ошибка получения статуса External API:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Принудительная проверка внешнего API
router.post('/admin/force-check', async (req, res) => {
  try {
    const externalAPI = global.externalAPI;
    
    if (!externalAPI) {
      return res.status(503).json({
        error: 'External API не инициализирован'
      });
    }

    console.log('🔍 Принудительная проверка External API...');
    const result = await externalAPI.checkForNewFights();
    
    res.json({
      success: true,
      message: 'Проверка завершена',
      result: {
        found: result ? 'Найден новый бой' : 'Новых боев не найдено',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка принудительной проверки:', error);
    res.status(500).json({ 
      error: 'Ошибка проверки External API',
      details: error.message 
    });
  }
});

// === PARSER ENDPOINTS ===

// Получить конфигурацию парсера
router.get('/admin/parser-config', (req, res) => {
  try {
    const config = webParser.getConfig();
    const status = webParser.getStatus();
    
    res.json({
      success: true,
      config: config,
      status: status
    });
  } catch (error) {
    console.error('Ошибка получения конфигурации парсера:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранить конфигурацию парсера
router.post('/admin/parser-config', async (req, res) => {
  try {
    const config = req.body;
    
    // Валидация конфигурации
    const validation = webParser.validateConfig(config);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Неверная конфигурация парсера',
        details: validation.errors
      });
    }
    
    // Сохранение конфигурации
    await webParser.setConfig(config);
    
    console.log(`🔧 Конфигурация парсера обновлена: ${config.name}`);
    
    res.json({
      success: true,
      message: 'Конфигурация парсера сохранена',
      config: config
    });
  } catch (error) {
    console.error('Ошибка сохранения конфигурации парсера:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Тестирование парсера
router.post('/admin/parser-test', async (req, res) => {
  try {
    const testConfig = req.body;
    
    console.log(`🧪 Тестирование парсера: ${testConfig.name}`);
    
    // Валидация конфигурации
    const validation = webParser.validateConfig(testConfig);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Неверная конфигурация парсера',
        details: validation.errors
      });
    }
    
    // Тестирование парсера
    const result = await webParser.testParser(testConfig);
    
    res.json({
      success: true,
      message: 'Тестирование завершено',
      result: result
    });
  } catch (error) {
    console.error('Ошибка тестирования парсера:', error);
    res.status(500).json({ 
      error: 'Ошибка тестирования парсера',
      details: error.message 
    });
  }
});

// Получить статус парсера
router.get('/admin/parser-status', (req, res) => {
  try {
    const status = webParser.getStatus();
    
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Ошибка получения статуса парсера:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Принудительный парсинг с текущей конфигурацией
router.post('/admin/parser-run', async (req, res) => {
  try {
    const status = webParser.getStatus();
    
    if (!status.isConfigured) {
      return res.status(400).json({
        error: 'Парсер не настроен'
      });
    }
    
    console.log('🚀 Принудительный запуск парсера...');
    
    const result = await webParser.parsePage();
    
    res.json({
      success: true,
      message: 'Парсинг завершен',
      data: result
    });
  } catch (error) {
    console.error('Ошибка принудительного парсинга:', error);
    res.status(500).json({ 
      error: 'Ошибка парсинга',
      details: error.message 
    });
  }
});

// === API ИСТОЧНИКИ ДАННЫХ ===

// Получить список доступных источников данных
router.get('/admin/api-sources', (req, res) => {
  try {
    const externalAPI = global.externalAPI;
    
    if (!externalAPI) {
      return res.status(503).json({
        error: 'External API не инициализирован'
      });
    }

    const sources = externalAPI.getAvailableSources();
    
    res.json({
      success: true,
      sources: sources,
      currentInterval: '7 минут'
    });
  } catch (error) {
    console.error('Ошибка получения источников данных:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Переключить источник данных
router.post('/admin/switch-source', (req, res) => {
  try {
    const { sourceIndex } = req.body;
    const externalAPI = global.externalAPI;
    
    if (!externalAPI) {
      return res.status(503).json({
        error: 'External API не инициализирован'
      });
    }

    if (typeof sourceIndex !== 'number' || sourceIndex < 0) {
      return res.status(400).json({
        error: 'Неверный индекс источника данных'
      });
    }

    const success = externalAPI.switchSource(sourceIndex);
    
    if (success) {
      const sources = externalAPI.getAvailableSources();
      const currentSource = sources.find(s => s.isActive);
      
      console.log(`🔄 Источник данных переключен на: ${currentSource.name}`);
      
      res.json({
        success: true,
        message: `Источник данных переключен на: ${currentSource.name}`,
        currentSource: currentSource
      });
    } else {
      res.status(400).json({
        error: 'Не удалось переключить источник данных'
      });
    }
  } catch (error) {
    console.error('Ошибка переключения источника данных:', error);
    res.status(500).json({ 
      error: 'Ошибка переключения источника',
      details: error.message 
    });
  }
});

export default router; 