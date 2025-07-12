// Модуль для получения данных о боях с внешних источников
import { memoryStorage } from './memoryStorage.js';

// Импорт веб-парсера
import webParser from './webParser.js';

class ExternalFightAPI {
  constructor() {
    // Генерируем случайный интервал от 7 до 9 минут
    const randomMinutes = Math.floor(Math.random() * 3) + 7; // 7, 8, или 9 минут
    const randomSeconds = Math.floor(Math.random() * 60); // случайные секунды для большей рандомности
    
    this.config = {
      checkInterval: (randomMinutes * 60 + randomSeconds) * 1000, // случайное время от 7 до 9 минут
      apiSources: [
        {
          name: 'UFC Official API',
          url: 'https://api.ufc.com/v1/events/current',
          parser: this.parseUFCAPI.bind(this)
        },
        {
          name: 'ESPN UFC',
          url: 'https://api.espn.com/v1/mma/ufc/events',
          parser: this.parseESPNAPI.bind(this)
        },
        {
          name: 'Web Parser (настраиваемый)',
          url: 'web-parser',
          parser: this.parseWebPage.bind(this)
        },
        {
          name: 'Mock API (для тестов)',
          url: 'mock',
          parser: this.parseMockAPI.bind(this)
        }
      ],
      currentSource: 2 // Используем веб-парсер
    };
    
    this.lastCheck = null;
    this.isChecking = false;
  }

  // Запустить периодическую проверку новых боев
  startMonitoring() {
    const minutes = Math.floor(this.config.checkInterval / 60000);
    const seconds = Math.floor((this.config.checkInterval % 60000) / 1000);
    console.log(`🔍 Запуск мониторинга боев каждые ${minutes} минут ${seconds} секунд`);
    
    // Сразу проверяем при запуске
    this.checkForNewFights();
    
    // Затем периодически
    setInterval(() => {
      this.checkForNewFights();
    }, this.config.checkInterval);
  }

  // Основная функция проверки новых боев
  async checkForNewFights() {
    if (this.isChecking) {
      console.log('⏳ Проверка уже выполняется, пропускаем...');
      return { status: 'already_checking', message: 'Проверка уже выполняется' };
    }

    this.isChecking = true;
    this.lastCheck = new Date().toISOString();

    try {
      console.log('🔍 Проверяем новые бои...');
      
      const currentState = memoryStorage.getCurrentState();
      const newFightData = await this.fetchCurrentFight();
      
      if (!newFightData) {
        console.log('😴 Активных боев не найдено');
        return { status: 'no_fights', message: 'Активных боев не найдено' };
      }

      // Проверяем, отличается ли новый бой от текущего
      if (this.shouldStartNewFight(currentState.fight, newFightData)) {
        console.log(`🆕 Найден новый бой: ${newFightData.fighter1_name} vs ${newFightData.fighter2_name}`);
        
        const fight = memoryStorage.startNewFight(newFightData);
        
        // Уведомляем всех клиентов о новом бое
        this.broadcastNewFight(fight);
        
        return { status: 'new_fight', message: `Новый бой: ${fight.fighter1_name} vs ${fight.fighter2_name}`, fight };
      } else {
        console.log('✅ Текущий бой все еще активен');
        return { status: 'current_active', message: 'Текущий бой все еще активен' };
      }

    } catch (error) {
      console.error('❌ Ошибка при проверке новых боев:', error);
      return { status: 'error', message: error.message };
    } finally {
      this.isChecking = false;
    }
  }

  // Получить текущий бой с внешнего API
  async fetchCurrentFight() {
    const source = this.config.apiSources[this.config.currentSource];
    
    try {
      console.log(`📡 Запрос к ${source.name}...`);
      return await source.parser(source.url);
    } catch (error) {
      console.error(`❌ Ошибка получения данных от ${source.name}:`, error);
      return null;
    }
  }

  // Определить, нужно ли начинать новый бой
  shouldStartNewFight(currentFight, newFightData) {
    if (!currentFight) {
      return true; // Нет текущего боя, начинаем новый
    }

    if (!newFightData) {
      return false; // Нет новых данных
    }

    // Сравниваем по ID или по именам бойцов
    if (newFightData.id && currentFight.id !== newFightData.id) {
      return true;
    }

    // Если нет ID, сравниваем по именам
    const currentNames = `${currentFight.fighter1_name} vs ${currentFight.fighter2_name}`;
    const newNames = `${newFightData.fighter1_name} vs ${newFightData.fighter2_name}`;
    
    return currentNames !== newNames;
  }

  // Уведомить всех клиентов о новом бое
  broadcastNewFight(fight) {
    if (global.socketIO) {
      global.socketIO.emit('new_fight_started', {
        fight,
        votes: memoryStorage.getVoteStats(),
        message: `Новый бой начался: ${fight.fighter1_name} vs ${fight.fighter2_name}!`
      });
      console.log(`📢 Уведомление о новом бое отправлено всем клиентам`);
    }
  }

  // === ПАРСЕРЫ ДЛЯ РАЗЛИЧНЫХ API ===

  // Парсер для официального UFC API
  async parseUFCAPI(url) {
    // Реальная реализация будет делать HTTP запрос
    // const response = await fetch(url);
    // const data = await response.json();
    
    // Пример структуры данных:
    throw new Error('UFC API парсер не реализован - требует API ключ');
  }

  // Парсер для ESPN API
  async parseESPNAPI(url) {
    // Реальная реализация
    // const response = await fetch(url);
    // const data = await response.json();
    
    throw new Error('ESPN API парсер не реализован');
  }

  // Парсер для веб-страниц (использует webParser)
  async parseWebPage(url) {
    try {
      const status = webParser.getStatus();
      
      if (!status.isConfigured) {
        throw new Error('Веб-парсер не настроен');
      }

      if (!status.isActive) {
        throw new Error('Веб-парсер отключен');
      }

      console.log(`🌐 Парсинг веб-страницы: ${status.targetUrl}`);
      
      const result = await webParser.parsePage();
      
      // Добавляем дополнительные поля для совместимости
      result.status = 'active';
      result.is_active = true;
      result.startTime = new Date().toISOString();
      result.fighter1_votes = 0;
      result.fighter2_votes = 0;
      result.total_votes = 0;
      
      return result;
    } catch (error) {
      console.error('❌ Ошибка веб-парсинга:', error);
      throw error;
    }
  }

  // Mock парсер для тестирования
  async parseMockAPI(url) {
    // Имитируем случайное появление новых боев
    const mockFights = [
      {
        id: 'mock-fight-1',
        fighter1_name: 'Конор МакГрегор',
        fighter2_name: 'Хабиб Нурмагомедов',
        fighter1_image: 'https://dmxg5wxfqgb4u.cloudfront.net/styles/card_advance_small_280x356/s3/2024-10/101224-Conor-McGregor-GettyImages-1129769522.jpg?itok=ldON2KfI',
        fighter2_image: 'https://dmxg5wxfqgb4u.cloudfront.net/styles/card_advance_small_280x356/s3/2023-04/041523-Khabib-Nurmagomedov-GettyImages-1154585543.jpg?itok=1eSgYS1e',
        event_name: 'UFC 300: Revenge',
        event_date: new Date().toISOString()
      },
      {
        id: 'mock-fight-2',
        fighter1_name: 'Джон Джонс',
        fighter2_name: 'Стипе Миочич',
        fighter1_image: 'https://dmxg5wxfqgb4u.cloudfront.net/styles/card_advance_small_280x356/s3/2023-04/041523-Jon-Jones-GettyImages-1434072036.jpg?itok=7y1r9jP2',
        fighter2_image: 'https://dmxg5wxfqgb4u.cloudfront.net/styles/card_advance_small_280x356/s3/2023-04/041523-Stipe-Miocic-GettyImages-1434072039.jpg?itok=3y1f2kJl',
        event_name: 'UFC 301: Heavyweight Supremacy',
        event_date: new Date().toISOString()
      },
      {
        id: 'mock-fight-3',
        fighter1_name: 'Исраэль Адесанья',
        fighter2_name: 'Алекс Перейра',
        fighter1_image: 'https://dmxg5wxfqgb4u.cloudfront.net/styles/card_advance_small_280x356/s3/2024-10/101224-Israel-Adesanya-GettyImages-1666031673.jpg?itok=2fFg5h8K',
        fighter2_image: 'https://dmxg5wxfqgb4u.cloudfront.net/styles/card_advance_small_280x356/s3/2024-10/101224-Alex-Pereira-GettyImages-1468282648.jpg?itok=8fGh2kVx',
        event_name: 'UFC 302: Middleweight Mayhem',
        event_date: new Date().toISOString()
      }
    ];

    // Всегда возвращаем бой (для стабильного демо)

    const currentState = memoryStorage.getCurrentState();
    let availableFights = mockFights;

    // Исключаем текущий бой из возможных вариантов
    if (currentState.fight) {
      availableFights = mockFights.filter(fight => 
        fight.id !== currentState.fight.id
      );
    }

    if (availableFights.length === 0) {
      return null;
    }

    // Возвращаем случайный бой
    const randomIndex = Math.floor(Math.random() * availableFights.length);
    const selectedFight = availableFights[randomIndex];

    console.log(`🎲 Mock API: выбран бой ${selectedFight.fighter1_name} vs ${selectedFight.fighter2_name}`);
    return selectedFight;
  }

  // === УТИЛИТЫ ===

  // Переключить источник данных
  switchSource(sourceIndex) {
    if (sourceIndex >= 0 && sourceIndex < this.config.apiSources.length) {
      this.config.currentSource = sourceIndex;
      const source = this.config.apiSources[sourceIndex];
      console.log(`🔄 Переключились на источник: ${source.name}`);
      return true;
    }
    return false;
  }

  // Получить список доступных источников
  getAvailableSources() {
    return this.config.apiSources.map((source, index) => ({
      index,
      name: source.name,
      isActive: index === this.config.currentSource,
      url: source.url
    }));
  }

  // Получить статус мониторинга
  getStatus() {
    const source = this.config.apiSources[this.config.currentSource];
    return {
      isActive: true,
      currentSource: source.name,
      lastCheck: this.lastCheck,
      nextCheck: this.lastCheck ? 
        new Date(new Date(this.lastCheck).getTime() + this.config.checkInterval).toISOString() : 
        'скоро',
              checkInterval: Math.floor(this.config.checkInterval / 60000) + ' минут ' + Math.floor((this.config.checkInterval % 60000) / 1000) + ' секунд',
      isChecking: this.isChecking,
      isHealthy: true,
      totalChecks: this.lastCheck ? 1 : 0
    };
  }

  // Принудительная проверка (для админской панели)
  async forceCheck() {
    console.log('🔍 Принудительная проверка новых боев...');
    const result = await this.checkForNewFights();
    return result;
  }

  // Остановить мониторинг
  stopMonitoring() {
    console.log('⏹️ Мониторинг остановлен');
    // В реальной реализации нужно будет clearInterval
  }
}

// Экспортируем singleton экземпляр
export const externalAPI = new ExternalFightAPI();
export default ExternalFightAPI; 