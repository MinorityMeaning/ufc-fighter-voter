// In-Memory Storage для UFC голосования без БД
import { v4 as uuidv4 } from 'uuid';

class MemoryStorage {
  constructor() {
    this.gameState = {
      currentFight: null,
      votes: {
        fighter1: 0,
        fighter2: 0,
        total: 0
      },
      userSessions: new Map(), // sessionId -> fighterChoice (1 or 2)
      fightHistory: [], // последние завершенные бои
      isActive: false,
      lastUpdate: null
    };
    
    this.config = {
      maxHistorySize: 10,
      backupInterval: 5 * 60 * 1000, // 5 минут
      fightCheckInterval: 10 * 60 * 1000 // 10 минут
    };
    
    // Запускаем автосохранение
    this.startBackupScheduler();
  }

  // Получить текущее состояние игры
  getCurrentState() {
    return {
      fight: this.gameState.currentFight,
      votes: { ...this.gameState.votes },
      isActive: this.gameState.isActive,
      lastUpdate: this.gameState.lastUpdate,
      totalUsers: this.gameState.userSessions.size
    };
  }

  // Начать новый бой
  startNewFight(fightData) {
    // Сохраняем предыдущий бой в историю
    if (this.gameState.currentFight) {
      this.addToHistory({
        ...this.gameState.currentFight,
        finalVotes: { ...this.gameState.votes },
        endTime: new Date().toISOString()
      });
    }

    // Сбрасываем состояние для нового боя
    this.gameState.currentFight = {
      id: fightData.id || uuidv4(),
      fighter1_name: fightData.fighter1_name,
      fighter2_name: fightData.fighter2_name,
      fighter1_image: fightData.fighter1_image,
      fighter2_image: fightData.fighter2_image,
      event_name: fightData.event_name,
      startTime: new Date().toISOString(),
      status: 'active',
      is_active: true, // Добавляем поле активности для клиента
      is_live: fightData.is_live || false, // Добавляем LIVE статус
      fighter1_votes: 0, // Добавляем счетчики голосов
      fighter2_votes: 0,
      total_votes: 0
    };

    this.gameState.votes = { fighter1: 0, fighter2: 0, total: 0 };
    this.gameState.userSessions.clear();
    this.gameState.isActive = true;
    this.gameState.lastUpdate = new Date().toISOString();

    console.log(`🥊 Новый бой начался: ${fightData.fighter1_name} vs ${fightData.fighter2_name} (живой: ${fightData.is_live ? 'ДА' : 'НЕТ'})`);
    return this.gameState.currentFight;
  }

  // Добавить голос
  addVote(sessionId, fighterChoice, ipAddress = null) {
    if (!this.gameState.isActive || !this.gameState.currentFight) {
      throw new Error('Нет активного боя для голосования');
    }

    if (![1, 2].includes(fighterChoice)) {
      throw new Error('Неверный выбор бойца');
    }

    // Проверяем, не голосовал ли уже этот пользователь
    if (this.gameState.userSessions.has(sessionId)) {
      throw new Error('Пользователь уже голосовал в этом бою');
    }

    // Добавляем голос
    this.gameState.userSessions.set(sessionId, fighterChoice);
    
    if (fighterChoice === 1) {
      this.gameState.votes.fighter1++;
      this.gameState.currentFight.fighter1_votes++;
    } else {
      this.gameState.votes.fighter2++;
      this.gameState.currentFight.fighter2_votes++;
    }
    this.gameState.votes.total++;
    this.gameState.currentFight.total_votes++;
    this.gameState.lastUpdate = new Date().toISOString();

    console.log(`🗳️ Новый голос: fighter${fighterChoice}, всего голосов: ${this.gameState.votes.total}`);
    
    return {
      success: true,
      votes: { ...this.gameState.votes }
    };
  }

  // Проверить, голосовал ли пользователь
  checkUserVoted(sessionId) {
    const fighterChoice = this.gameState.userSessions.get(sessionId);
    return {
      hasVoted: !!fighterChoice,
      fighterChoice: fighterChoice || null
    };
  }

  // Получить статистику голосования
  getVoteStats() {
    const total = this.gameState.votes.total;
    return {
      fighter1_votes: this.gameState.votes.fighter1,
      fighter2_votes: this.gameState.votes.fighter2,
      total_votes: total,
      fighter1_percentage: total > 0 ? Math.round((this.gameState.votes.fighter1 / total) * 100) : 0,
      fighter2_percentage: total > 0 ? Math.round((this.gameState.votes.fighter2 / total) * 100) : 0,
      active_users: this.gameState.userSessions.size
    };
  }

  // Завершить текущий бой
  endCurrentFight() {
    if (this.gameState.currentFight) {
      this.gameState.isActive = false;
      this.gameState.currentFight.is_active = false; // Обновляем поле в объекте боя
      
      this.addToHistory({
        ...this.gameState.currentFight,
        finalVotes: { ...this.gameState.votes },
        endTime: new Date().toISOString()
      });
      
      console.log(`🏁 Бой завершен: ${this.gameState.currentFight.fighter1_name} vs ${this.gameState.currentFight.fighter2_name}`);
      console.log(`📊 Финальные голоса: ${this.gameState.votes.fighter1} vs ${this.gameState.votes.fighter2}`);
      
      return true;
    }
    return false;
  }

  // Добавить бой в историю
  addToHistory(fightData) {
    this.gameState.fightHistory.unshift(fightData);
    
    // Ограничиваем размер истории
    if (this.gameState.fightHistory.length > this.config.maxHistorySize) {
      this.gameState.fightHistory = this.gameState.fightHistory.slice(0, this.config.maxHistorySize);
    }
  }

  // Получить историю боев
  getFightHistory(limit = 5) {
    return this.gameState.fightHistory.slice(0, limit);
  }

  // Получить статистику сервера
  getServerStats() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeConnections: this.gameState.userSessions.size,
      currentFight: !!this.gameState.currentFight,
      totalVotes: this.gameState.votes.total,
      fightHistoryCount: this.gameState.fightHistory.length
    };
  }

  // Backup состояния в файл (опционально)
  async backupToFile(filePath = './backup/gameState.json') {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Создаем директорию если не существует
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Убеждаемся, что currentFight содержит все необходимые поля
      const currentFight = this.gameState.currentFight ? {
        ...this.gameState.currentFight,
        // Добавляем недостающие поля если их нет
        fighter1_name: this.gameState.currentFight.fighter1_name || '',
        fighter2_name: this.gameState.currentFight.fighter2_name || '',
        fighter1_image: this.gameState.currentFight.fighter1_image || '',
        fighter2_image: this.gameState.currentFight.fighter2_image || '',
        event_name: this.gameState.currentFight.event_name || '',
        is_active: this.gameState.currentFight.is_active !== undefined ? this.gameState.currentFight.is_active : this.gameState.isActive,
        fighter1_votes: this.gameState.currentFight.fighter1_votes || this.gameState.votes.fighter1,
        fighter2_votes: this.gameState.currentFight.fighter2_votes || this.gameState.votes.fighter2,
        total_votes: this.gameState.currentFight.total_votes || this.gameState.votes.total
      } : null;
      
      // Конвертируем Map в обычный объект для JSON
      const backupData = {
        currentFight: currentFight,
        votes: this.gameState.votes,
        userSessions: Object.fromEntries(this.gameState.userSessions),
        fightHistory: this.gameState.fightHistory,
        isActive: this.gameState.isActive,
        lastUpdate: this.gameState.lastUpdate,
        backupTime: new Date().toISOString()
      };
      
      await fs.writeFile(filePath, JSON.stringify(backupData, null, 2));
      console.log(`💾 Backup сохранен: ${filePath}`);
    } catch (error) {
      console.error('❌ Ошибка сохранения backup:', error);
    }
  }

  // Восстановить состояние из файла
  async restoreFromFile(filePath = './backup/gameState.json') {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(filePath, 'utf8');
      const backupData = JSON.parse(data);
      
      this.gameState.currentFight = backupData.currentFight;
      this.gameState.votes = backupData.votes || { fighter1: 0, fighter2: 0, total: 0 };
      this.gameState.userSessions = new Map(Object.entries(backupData.userSessions || {}));
      this.gameState.fightHistory = backupData.fightHistory || [];
      this.gameState.isActive = backupData.isActive || false;
      this.gameState.lastUpdate = backupData.lastUpdate;
      
      // Восстанавливаем недостающие поля из истории боев
      if (this.gameState.currentFight && !this.gameState.currentFight.fighter1_name) {
        // Ищем последний бой в истории с тем же ID
        const lastFight = this.gameState.fightHistory.find(fight => 
          fight.id === this.gameState.currentFight.id
        );
        
        if (lastFight) {
          // Восстанавливаем данные из истории
          this.gameState.currentFight.fighter1_name = lastFight.fighter1_name;
          this.gameState.currentFight.fighter2_name = lastFight.fighter2_name;
          this.gameState.currentFight.fighter1_image = lastFight.fighter1_image;
          this.gameState.currentFight.fighter2_image = lastFight.fighter2_image;
          this.gameState.currentFight.event_name = lastFight.event_name;
          console.log(`🔧 Восстановлены данные боя: ${lastFight.fighter1_name} vs ${lastFight.fighter2_name}`);
        }
      }
      
      // Добавляем недостающие поля в восстановленный бой для совместимости
      if (this.gameState.currentFight && this.gameState.currentFight.is_active === undefined) {
        this.gameState.currentFight.is_active = this.gameState.isActive;
        this.gameState.currentFight.fighter1_votes = this.gameState.votes.fighter1;
        this.gameState.currentFight.fighter2_votes = this.gameState.votes.fighter2;
        this.gameState.currentFight.total_votes = this.gameState.votes.total;
      }
      
      console.log(`📥 Состояние восстановлено из backup (${backupData.backupTime})`);
      console.log(`🗳️ Восстановлено голосов: ${this.gameState.votes.total}`);
      return true;
    } catch (error) {
      console.log('ℹ️ Backup файл не найден или поврежден, начинаем с пустого состояния');
      return false;
    }
  }

  // Запустить автоматическое сохранение
  startBackupScheduler() {
    setInterval(() => {
      this.backupToFile();
    }, this.config.backupInterval);
  }

  // Очистить старые сессии (cleanup)
  cleanupOldSessions(maxAge = 24 * 60 * 60 * 1000) { // 24 часа
    // В текущей реализации сессии очищаются при каждом новом бое
    // Можно добавить временные метки если нужно
    console.log(`🧹 Cleanup: активных сессий ${this.gameState.userSessions.size}`);
  }
}

// Экспортируем singleton экземпляр
export const memoryStorage = new MemoryStorage();
export default MemoryStorage; 