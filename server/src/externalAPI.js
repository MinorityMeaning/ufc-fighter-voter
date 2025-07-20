// Модуль для получения данных о боях с внешних источников
import { memoryStorage } from './memoryStorage.js';

// Импорт Selenium веб-парсера
import webParser from './webParserSelenium.js';

class ExternalFightAPI {
  constructor() {
        // Настройки для быстрых проверок
    this.config = {
      quickCheckInterval: 60 * 1000, // Быстрая проверка каждую минуту
      fullCheckInterval: (Math.floor(Math.random() * 11) + 30) * 60 * 1000, // Полная проверка каждые 30-40 минут
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
    const fullCheckMinutes = Math.floor(this.config.fullCheckInterval / 60000);
    console.log(`🔍 Запуск мониторинга боев:`);
    console.log(`   - Быстрая проверка каждую минуту`);
    console.log(`   - Полная проверка каждые ${fullCheckMinutes} минут`);
    
    // Сразу делаем полную проверку при запуске
    this.checkForNewFights();
    
    // Быстрые проверки каждую минуту
    setInterval(() => {
      this.quickCheckForNewFights();
    }, this.config.quickCheckInterval);
    
    // Полные проверки каждые 10 минут
    setInterval(() => {
      this.checkForNewFights();
    }, this.config.fullCheckInterval);
  }

  // Быстрая проверка новых боев (с парсингом всех боев)
  async quickCheckForNewFights() {
    if (this.isChecking) {
      return; // Пропускаем, если уже идет проверка
    }

    try {
      const status = webParser.getStatus();
      
      if (!status.isConfigured || !status.isActive) {
        return; // Парсер не готов
      }

      console.log('⚡ Быстрая проверка с парсингом всех боев...');
      
      // Делаем полную проверку, но без перезагрузки страницы
      const currentState = memoryStorage.getCurrentState();
      const newFightData = await this.fetchCurrentFight();
      
      if (!newFightData) {
        console.log('😴 Активных боев не найдено');
        return;
      }

      // Проверяем, отличается ли новый бой от текущего
      if (this.shouldStartNewFight(currentState.fight, newFightData)) {
        console.log(`🆕 Быстрая проверка: найден новый бой: ${newFightData.fighter1_name} vs ${newFightData.fighter2_name}`);
        
        const fight = memoryStorage.startNewFight(newFightData);
        
        // Уведомляем всех клиентов о новом бое
        this.broadcastNewFight(fight);
      } else {
        console.log('✅ Быстрая проверка: текущий бой все еще активен');
      }

    } catch (error) {
      console.error('❌ Ошибка быстрой проверки:', error);
    }
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
      console.log(`🔍 Сравнение боев:`);
      console.log(`   Текущий: ${currentState.fight ? `${currentState.fight.fighter1_name} vs ${currentState.fight.fighter2_name}` : 'НЕТ'}`);
      console.log(`   Новый: ${newFightData.fighter1_name} vs ${newFightData.fighter2_name}`);
      
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
    console.log(`🔍 shouldStartNewFight проверка:`);
    console.log(`   currentFight: ${currentFight ? 'ЕСТЬ' : 'НЕТ'}`);
    console.log(`   newFightData: ${newFightData ? 'ЕСТЬ' : 'НЕТ'}`);
    
    if (!currentFight) {
      console.log(`   Результат: НЕТ текущего боя -> НАЧИНАЕМ НОВЫЙ`);
      return true; // Нет текущего боя, начинаем новый
    }

    if (!newFightData) {
      console.log(`   Результат: НЕТ новых данных -> НЕ НАЧИНАЕМ`);
      return false; // Нет новых данных
    }

    // Сравниваем по ID или по именам бойцов
    if (newFightData.id && currentFight.id !== newFightData.id) {
      console.log(`   Результат: РАЗНЫЕ ID -> НАЧИНАЕМ НОВЫЙ`);
      return true;
    }

    // Если нет ID, сравниваем по именам
    const currentNames = `${currentFight.fighter1_name} vs ${currentFight.fighter2_name}`;
    const newNames = `${newFightData.fighter1_name} vs ${newFightData.fighter2_name}`;
    
    // Проверяем LIVE статус - если новый бой LIVE, то переключаемся
    console.log(`   🔍 Проверка LIVE статуса:`);
    console.log(`      Текущий бой LIVE: ${currentFight.is_live ? 'ДА' : 'НЕТ'}`);
    console.log(`      Новый бой LIVE: ${newFightData.is_live ? 'ДА' : 'НЕТ'}`);
    
    if (newFightData.is_live) {
      console.log(`   Результат: НОВЫЙ LIVE бой -> НАЧИНАЕМ НОВЫЙ`);
      return true;
    }
    
    // Если имена разные, начинаем новый бой
    const shouldStart = currentNames !== newNames;
    console.log(`   Результат: ${shouldStart ? 'РАЗНЫЕ ИМЕНА -> НАЧИНАЕМ НОВЫЙ' : 'ТЕ ЖЕ ИМЕНА -> НЕ НАЧИНАЕМ'}`);
    
    return shouldStart;
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
      console.log(`📥 Результат парсинга получен:`, typeof result, Array.isArray(result) ? `массив из ${result.length} элементов` : 'объект');
      
      // Если результат - массив боев, ищем LIVE бой или берем первый
      console.log(`🔍 Начинаем анализ результата парсинга...`);
      let fightData = result;
      if (Array.isArray(result) && result.length > 0) {
        console.log(`🔍 Анализ ${result.length} боев для выбора...`);
        
        // Выводим все LIVE бои
        const liveFights = result.filter(fight => fight.is_live && !fight.has_outcome);
        console.log(`🔍 Найдено ${liveFights.length} LIVE боев без результата:`);
        liveFights.forEach((fight, index) => {
          const hasBanner = fight.has_visible_live_banner ? '✅' : '❌';
          console.log(`   ${index + 1}. ${fight.fighter1_name} vs ${fight.fighter2_name} (видимый banner: ${hasBanner})`);
        });
        
        // Сначала ищем LIVE бой с видимым banner'ом
        const liveFightWithBanner = result.find(fight => fight.is_live && fight.has_visible_live_banner && !fight.has_outcome);
        if (liveFightWithBanner) {
          fightData = liveFightWithBanner;
          console.log(`🔥 Найден LIVE бой с видимым banner'ом: ${fightData.fighter1_name} vs ${fightData.fighter2_name}`);
        } else {
          // Если нет боя с видимым banner'ом, ищем любой LIVE бой
          const liveFight = result.find(fight => fight.is_live && !fight.has_outcome);
          if (liveFight) {
            fightData = liveFight;
            console.log(`🔥 Найден LIVE бой (без видимого banner'а): ${fightData.fighter1_name} vs ${fightData.fighter2_name}`);
          } else {
            // Если LIVE боя нет, ищем следующую пару бойцов после той, у которой есть outcome
            let nextFight = null;
            
            // Ищем первый бой с outcome
            let firstCompletedFightIndex = -1;
            for (let i = 0; i < result.length; i++) {
              if (result[i].has_outcome) {
                firstCompletedFightIndex = i;
                console.log(`🔍 Первый завершенный бой на позиции ${i + 1}: ${result[i].fighter1_name} vs ${result[i].fighter2_name}`);
                break;
              }
            }
            
            if (firstCompletedFightIndex !== -1) {
              // Ищем бой до первого завершенного
              for (let i = firstCompletedFightIndex - 1; i >= 0; i--) {
                if (!result[i].has_outcome) {
                  nextFight = result[i];
                  console.log(`📄 Найден бой до завершенного на позиции ${i + 1}: ${nextFight.fighter1_name} vs ${nextFight.fighter2_name}`);
                  break;
                }
              }
            }
            
            // Если не нашли после завершенного, берем первый без результата
            if (!nextFight) {
              nextFight = result.find(fight => !fight.has_outcome);
              if (nextFight) {
                console.log(`📄 Возвращаем первый активный бой: ${nextFight.fighter1_name} vs ${nextFight.fighter2_name} (живой: ${nextFight.is_live ? 'ДА' : 'НЕТ'})`);
              }
            }
            
            if (nextFight) {
              fightData = nextFight;
            } else {
              // Если все бои завершены, берем первый
              fightData = result[0];
              console.log(`📄 Возвращаем завершенный бой: ${fightData.fighter1_name} vs ${fightData.fighter2_name} (живой: ${fightData.is_live ? 'ДА' : 'НЕТ'})`);
            }
          }
        }
      }
      
      // Добавляем дополнительные поля для совместимости
      fightData.status = 'active';
      fightData.is_active = true;
      fightData.startTime = new Date().toISOString();
      fightData.fighter1_votes = 0;
      fightData.fighter2_votes = 0;
      fightData.total_votes = 0;
      
      return fightData;
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
    
    // Безопасная обработка дат
    let nextCheck = 'скоро';
    let checkInterval = 'неизвестно';
    
    if (this.lastCheck) {
      try {
        const lastCheckDate = new Date(this.lastCheck);
        if (!isNaN(lastCheckDate.getTime())) {
          const nextCheckDate = new Date(lastCheckDate.getTime() + this.config.fullCheckInterval);
          nextCheck = nextCheckDate.toISOString();
        }
      } catch (error) {
        console.warn('⚠️ Ошибка обработки даты lastCheck:', error);
      }
    }
    
    try {
      const fullCheckMinutes = Math.floor(this.config.fullCheckInterval / 60000);
      const quickCheckSeconds = Math.floor(this.config.quickCheckInterval / 1000);
      checkInterval = `Быстрая: ${quickCheckSeconds}с, Полная: ${fullCheckMinutes}м`;
    } catch (error) {
      console.warn('⚠️ Ошибка расчета интервалов:', error);
    }
    
    return {
      isActive: true,
      currentSource: source.name,
      lastCheck: this.lastCheck,
      nextCheck: nextCheck,
      checkInterval: checkInterval,
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