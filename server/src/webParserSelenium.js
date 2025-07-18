import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import * as fs from 'fs';
import path from 'path';

class WebParserSelenium {
  constructor() {
    this.config = null;
    this.lastParseResult = null;
    this.configPath = path.join(process.cwd(), 'ufc-parser-config.json');
    this.driver = null;
    this.userDataDir = null; // Сохраняем путь к временной папке
    
    // Автоматически загружаем конфигурацию при создании
    this.loadConfig().catch(error => {
      console.error('❌ Ошибка загрузки конфигурации парсера:', error);
    });
  }

  // Загрузка конфигурации из файла
  async loadConfig() {
    try {
      const configData = await fs.promises.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      console.log(`📥 Конфигурация парсера загружена: ${this.config.name}`);
    } catch (error) {
      console.log('📝 Файл конфигурации парсера не найден, будет создан при первой настройке');
    }
  }

  // Инициализация драйвера
  async initDriver() {
    if (!this.driver) {
      try {
        console.log('🌐 Запуск Chrome через Selenium...');
        
        // Генерируем уникальную папку для пользовательских данных
        this.userDataDir = `/tmp/chrome-ufc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Настройки Chrome для обхода блокировок
        const options = new chrome.Options();
        options.addArguments('--headless'); // Запуск без GUI для серверов без видеокарты
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--disable-blink-features=AutomationControlled');
        options.addArguments('--disable-extensions');
        options.addArguments('--disable-plugins');
        options.addArguments('--disable-images'); // Ускоряем загрузку
        options.addArguments('--disable-javascript-harmony-shipping');
        options.addArguments('--disable-background-timer-throttling');
        options.addArguments('--disable-backgrounding-occluded-windows');
        options.addArguments('--disable-renderer-backgrounding');
        options.addArguments('--disable-features=TranslateUI');
        options.addArguments('--disable-ipc-flooding-protection');
        options.addArguments(`--user-data-dir=${this.userDataDir}`); // Уникальная папка для каждого экземпляра
        options.addArguments('--no-first-run');
        options.addArguments('--no-default-browser-check');
        options.addArguments('--disable-default-apps');
        
        // Устанавливаем User-Agent как у реального браузера
        options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Скрываем признаки автоматизации
        options.setUserPreferences({
          'profile.default_content_setting_values.notifications': 2,
          'profile.default_content_settings.popups': 0,
          'profile.managed_default_content_settings.images': 2
        });

        this.driver = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(options)
          .build();
      } catch (error) {
        console.error(`❌ Ошибка инициализации Chrome драйвера: ${error.message}`);
        
        // Очищаем временную папку при ошибке
        if (this.userDataDir) {
          try {
            if (fs.existsSync(this.userDataDir)) {
              fs.rmSync(this.userDataDir, { recursive: true, force: true });
            }
          } catch (cleanupError) {
            console.warn(`⚠️ Не удалось очистить временную папку при ошибке: ${cleanupError.message}`);
          }
          this.userDataDir = null;
        }
        
        throw error;
      }
    }
    return this.driver;
  }

  // Закрытие драйвера
  async closeDriver() {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
    }
    
    // Очищаем временную папку Chrome
    if (this.userDataDir) {
      try {
        if (fs.existsSync(this.userDataDir)) {
          fs.rmSync(this.userDataDir, { recursive: true, force: true });
          console.log(`🧹 Очищена временная папка Chrome: ${this.userDataDir}`);
        }
      } catch (error) {
        console.warn(`⚠️ Не удалось очистить временную папку: ${error.message}`);
      }
      this.userDataDir = null;
    }
  }

  // Парсинг страницы с выполнением JavaScript
  async parsePage(url = null, forceReload = false) {
    const targetUrl = url || this.config?.url;
    
    if (!targetUrl) {
      throw new Error('URL не задан');
    }

    const driver = await this.initDriver();

    try {
      // Проверяем, нужно ли загружать страницу заново
      const currentUrl = await driver.getCurrentUrl();
      const shouldReload = forceReload || currentUrl !== targetUrl;
      
      if (shouldReload) {
        console.log(`🌐 Загрузка новой страницы с Selenium: ${targetUrl}`);
        await driver.get(targetUrl);
        await driver.wait(until.elementLocated(By.css('body')), 60000);
        await driver.sleep(3000);
      } else {
        console.log(`🔄 Быстрая проверка уже открытой страницы: ${currentUrl}`);
        // Ждем немного для обновления динамического контента
        await driver.sleep(1000);
      }
      
      // Выполняем JavaScript для анализа live статуса
      const liveAnalysis = await driver.executeScript(() => {
        const results = {
          allLiveBanners: [],
          visibleLiveBanners: [],
          globalLiveIndicators: [],
          hiddenElements: [],
          liveStatus: false
        };

        // Ищем все live banner'ы
        const allBanners = document.querySelectorAll('.c-listing-fight__banner--live');
        allBanners.forEach((banner, index) => {
          const isHidden = banner.classList.contains('hidden');
          const text = banner.textContent.trim();
          const classes = banner.className;
          
          results.allLiveBanners.push({
            index,
            text,
            classes,
            isHidden,
            html: banner.outerHTML
          });

          if (!isHidden) {
            results.visibleLiveBanners.push({
              index,
              text,
              classes,
              html: banner.outerHTML
            });
          }
        });

        // Ищем глобальные live индикаторы
        const globalIndicators = document.querySelectorAll('.c-listing-ticker-fightcard__live');
        globalIndicators.forEach((indicator, index) => {
          const text = indicator.textContent.trim();
          const classes = indicator.className;
          
          results.globalLiveIndicators.push({
            index,
            text,
            classes,
            html: indicator.outerHTML
          });
        });

        // Ищем все скрытые элементы с "live" в классе
        const allElements = document.querySelectorAll('*');
        allElements.forEach((element) => {
          if (element.className && 
              typeof element.className === 'string' &&
              element.className.includes('live') && 
              element.classList.contains('hidden')) {
            results.hiddenElements.push({
              text: element.textContent.trim(),
              classes: element.className,
              tagName: element.tagName,
              html: element.outerHTML
            });
          }
        });

        // Определяем live статус - бой живой только если есть видимые live banner'ы (без класса hidden)
        results.liveStatus = results.visibleLiveBanners.length > 0;

        return results;
      });

      console.log('🔍 Анализ live элементов:');
      console.log(`   - Все live banner'ы: ${liveAnalysis.allLiveBanners.length}`);
      console.log(`   - Видимые live banner'ы: ${liveAnalysis.visibleLiveBanners.length}`);
      console.log(`   - Глобальные live индикаторы: ${liveAnalysis.globalLiveIndicators.length}`);
      console.log(`   - Скрытые live элементы: ${liveAnalysis.hiddenElements.length}`);
      console.log(`   - Общий live статус: ${liveAnalysis.liveStatus ? 'ДА' : 'НЕТ'}`);

      // Выводим детали видимых banner'ов
      if (liveAnalysis.visibleLiveBanners.length > 0) {
        console.log('🔍 Видимые live banner\'ы:');
        liveAnalysis.visibleLiveBanners.forEach((banner, index) => {
          console.log(`   ${index + 1}. "${banner.text}" (${banner.classes})`);
        });
      }

      // Выводим детали глобальных индикаторов
      if (liveAnalysis.globalLiveIndicators.length > 0) {
        console.log('🔍 Глобальные live индикаторы:');
        liveAnalysis.globalLiveIndicators.forEach((indicator, index) => {
          console.log(`   ${index + 1}. "${indicator.text}" (${indicator.classes})`);
        });
      }

      // Теперь парсим бои с обновленным HTML
      const selectors = this.config?.selectors || {};
      
      if (selectors.fightContainer) {
        const fights = await this.parseAllFightsWithSelenium(driver, selectors, targetUrl, liveAnalysis);
        return fights;
      } else {
        const result = await this.parseSingleFightWithSelenium(driver, selectors, targetUrl, liveAnalysis);
        return result;
      }

    } catch (error) {
      console.error(`❌ Ошибка парсинга с Selenium: ${error.message}`);
      throw error;
    }
  }

  // Быстрая проверка без перезагрузки страницы
  async quickCheck() {
    const targetUrl = this.config?.url;
    
    if (!targetUrl) {
      throw new Error('URL не задан');
    }

    const driver = await this.initDriver();

    try {
      // Проверяем, что страница открыта
      const currentUrl = await driver.getCurrentUrl();
      
      if (currentUrl !== targetUrl) {
        console.log(`⚠️ Страница не открыта, загружаем: ${targetUrl}`);
        return await this.parsePage(targetUrl, true);
      }

      console.log(`⚡ Быстрая проверка: ${currentUrl}`);
      
      // Ждем немного для обновления динамического контента
      await driver.sleep(1000);
      
      // Выполняем быстрый анализ только live статуса
      const liveAnalysis = await driver.executeScript(() => {
        const results = {
          visibleLiveBanners: [],
          liveStatus: false
        };

        // Быстрая проверка только видимых live banner'ов
        const allBanners = document.querySelectorAll('.c-listing-fight__banner--live');
        allBanners.forEach((banner) => {
          const isHidden = banner.classList.contains('hidden');
          if (!isHidden) {
            results.visibleLiveBanners.push({
              text: banner.textContent.trim(),
              classes: banner.className
            });
          }
        });

        results.liveStatus = results.visibleLiveBanners.length > 0;
        return results;
      });

      console.log(`⚡ Быстрая проверка: ${liveAnalysis.visibleLiveBanners.length} видимых live banner'ов, статус: ${liveAnalysis.liveStatus ? 'LIVE' : 'НЕ LIVE'}`);

      // Если есть live бои, делаем полный парсинг
      if (liveAnalysis.liveStatus) {
        console.log('🔥 Обнаружен LIVE бой! Делаем полный парсинг...');
        return await this.parsePage(targetUrl, false);
      }

      return { liveStatus: false, message: 'Нет live боев' };

    } catch (error) {
      console.error(`❌ Ошибка быстрой проверки: ${error.message}`);
      throw error;
    }
  }

  // Парсинг всех боев с Selenium
  async parseAllFightsWithSelenium(driver, selectors, targetUrl, liveAnalysis) {
    console.log(`🔍 Начинаем парсинг всех боев с Selenium`);
    console.log(`🔍 Селекторы для изображений:`);
    console.log(`   🖼️ Fighter1 image: "${selectors.fighter1Image}"`);
    console.log(`   🖼️ Fighter2 image: "${selectors.fighter2Image}"`);
    
    const fights = await driver.executeScript((selectors, liveAnalysis) => {
      const fightElements = document.querySelectorAll(selectors.fightContainer);
      const fights = [];
      
      console.log(`🔍 Найдено ${fightElements.length} боев для парсинга`);
      
      fightElements.forEach((fightElement, index) => {
        try {
          const fighter1Name = fightElement.querySelector(selectors.fighter1Name)?.textContent?.trim() || '';
          const fighter2Name = fightElement.querySelector(selectors.fighter2Name)?.textContent?.trim() || '';
          
          console.log(`🔍 Парсинг боя #${index + 1}:`);
          console.log(`   Имя 1: "${fighter1Name}" (селектор: ${selectors.fighter1Name})`);
          console.log(`   Имя 2: "${fighter2Name}" (селектор: ${selectors.fighter2Name})`);
          
          if (fighter1Name && fighter2Name) {
            const fighter1ImageElement = fightElement.querySelector(selectors.fighter1Image);
            const fighter2ImageElement = fightElement.querySelector(selectors.fighter2Image);
            const fighter1Image = fighter1ImageElement?.src || '';
            const fighter2Image = fighter2ImageElement?.src || '';
            const description = fightElement.querySelector(selectors.description)?.textContent?.trim() || '';
            
            console.log(`🔍 Бой ${index + 1}:`);
            console.log(`   👤 ${fighter1Name} vs ${fighter2Name}`);
            console.log(`   🖼️ Fighter1 image element: ${fighter1ImageElement ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
            console.log(`   🖼️ Fighter2 image element: ${fighter2ImageElement ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
            console.log(`   🖼️ Fighter1 image src: ${fighter1Image || 'ПУСТО'}`);
            console.log(`   🖼️ Fighter2 image src: ${fighter2Image || 'ПУСТО'}`);
            console.log(`   📝 Description: ${description || 'ПУСТО'}`);
            
            console.log(`   Изображение 1: "${fighter1Image}" (селектор: ${selectors.fighter1Image})`);
            console.log(`   Изображение 2: "${fighter2Image}" (селектор: ${selectors.fighter2Image})`);
            
            // Проверяем live статус для этого боя
            const liveBanner = fightElement.querySelector(selectors.liveIndicator);
            let isLive = false;
            
            if (liveBanner) {
              const isHidden = liveBanner.classList.contains('hidden');
              // Бой живой только если live banner НЕ имеет класс hidden
              isLive = !isHidden;
            }
            
            // Проверяем наличие элемента с результатом боя
            const outcomeElement = fightElement.querySelector('.c-listing-fight__outcome--win');
            const hasOutcome = outcomeElement !== null;
            
            fights.push({
              fighter1_name: fighter1Name,
              fighter2_name: fighter2Name,
              fighter1_image: fighter1Image,
              fighter2_image: fighter2Image,
              event_name: document.querySelector(selectors.eventName)?.textContent?.trim() || '',
              event_time: document.querySelector(selectors.eventTime)?.textContent?.trim() || '',
              description: description,
              is_live: isLive,
              has_outcome: hasOutcome,
              parsedAt: new Date().toISOString(),
              sourceUrl: window.location.href
            });
          }
        } catch (error) {
          console.warn(`⚠️ Ошибка парсинга боя #${index + 1}: ${error.message}`);
        }
      });
      
      return fights;
    }, selectors, liveAnalysis);

    // Обрабатываем результаты
    fights.forEach((fight, index) => {
      // Нормализация URL изображений
      fight.fighter1_image = this.normalizeImageUrl(fight.fighter1_image, targetUrl);
      fight.fighter2_image = this.normalizeImageUrl(fight.fighter2_image, targetUrl);
      
      // Генерация уникального ID для боя
      fight.id = this.generateFightId(fight.fighter1_name, fight.fighter2_name);
      
      console.log(`✅ Бой #${index + 1}: ${fight.fighter1_name} vs ${fight.fighter2_name} (живой: ${fight.is_live ? 'ДА' : 'НЕТ'}, outcome: ${fight.has_outcome ? 'ЕСТЬ' : 'НЕТ'})`);
      console.log(`   📸 Изображения: ${fight.fighter1_image ? '✅' : '❌'} / ${fight.fighter2_image ? '✅' : '❌'}`);
      console.log(`   🏷️ Имена: ${fight.fighter1_name ? '✅' : '❌'} / ${fight.fighter2_name ? '✅' : '❌'}`);
    });

    console.log(`📊 Извлечено ${fights.length} боев с Selenium`);
    return fights;
  }

  // Парсинг одного боя с Selenium
  async parseSingleFightWithSelenium(driver, selectors, targetUrl, liveAnalysis) {
    const result = await driver.executeScript((selectors, liveAnalysis) => {
      const fighter1Name = document.querySelector(selectors.fighter1Name)?.textContent?.trim() || '';
      const fighter2Name = document.querySelector(selectors.fighter2Name)?.textContent?.trim() || '';
      const fighter1Image = document.querySelector(selectors.fighter1Image)?.src || '';
      const fighter2Image = document.querySelector(selectors.fighter2Image)?.src || '';
      const eventName = document.querySelector(selectors.eventName)?.textContent?.trim() || '';
      const eventTime = document.querySelector(selectors.eventTime)?.textContent?.trim() || '';
      const description = document.querySelector(selectors.description)?.textContent?.trim() || '';
      
      // Проверяем live статус
      const liveBanner = document.querySelector(selectors.liveIndicator);
      let isLive = false;
      
      if (liveBanner) {
        const isHidden = liveBanner.classList.contains('hidden');
        const text = liveBanner.textContent.trim();
        isLive = !isHidden && (text.toLowerCase().includes('live') || text.toLowerCase().includes('прямой эфир'));
      }
      
      // Если не нашли live banner, используем глобальный статус
      if (!isLive && liveAnalysis.liveStatus) {
        isLive = true;
      }
      
      // Проверяем наличие элемента с результатом боя
      const outcomeElement = document.querySelector('.c-listing-fight__outcome--win');
      const hasOutcome = outcomeElement !== null;
      
      return {
        fighter1_name: fighter1Name,
        fighter2_name: fighter2Name,
        fighter1_image: fighter1Image,
        fighter2_image: fighter2Image,
        event_name: eventName,
        event_time: eventTime,
        description: description,
        is_live: isLive,
        has_outcome: hasOutcome,
        parsedAt: new Date().toISOString(),
        sourceUrl: window.location.href
      };
    }, selectors, liveAnalysis);

    // Нормализация URL изображений
    result.fighter1_image = this.normalizeImageUrl(result.fighter1_image, targetUrl);
    result.fighter2_image = this.normalizeImageUrl(result.fighter2_image, targetUrl);
    
    // Генерация уникального ID для боя
    result.id = this.generateFightId(result.fighter1_name, result.fighter2_name);
    
    this.lastParseResult = result;
    console.log(`✅ Парсинг с Selenium успешен: ${result.fighter1_name} vs ${result.fighter2_name} (живой: ${result.is_live ? 'ДА' : 'НЕТ'}, outcome: ${result.has_outcome ? 'ЕСТЬ' : 'НЕТ'})`);
    console.log(`   📸 Изображения: ${result.fighter1_image ? '✅' : '❌'} / ${result.fighter2_image ? '✅' : '❌'}`);
    console.log(`   🏷️ Имена: ${result.fighter1_name ? '✅' : '❌'} / ${result.fighter2_name ? '✅' : '❌'}`);
    
    return result;
  }

  // Нормализация URL изображения
  normalizeImageUrl(imageUrl, baseUrl) {
    if (!imageUrl) return null;
    
    try {
      // Если URL уже абсолютный, возвращаем как есть
      if (imageUrl.startsWith('http')) {
        return imageUrl;
      }
      
      // Если относительный, делаем абсолютным
      const base = new URL(baseUrl);
      return new URL(imageUrl, base.origin).href;
    } catch (error) {
      console.warn(`⚠️ Ошибка нормализации URL: ${error.message}`);
      return imageUrl;
    }
  }

  // Генерация ID для боя
  generateFightId(fighter1, fighter2) {
    // Убираем timestamp, используем только имена бойцов
    const names = [fighter1, fighter2].sort().join('-');
    const hash = Buffer.from(names).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    return `parsed-${hash.substring(0, 8)}`;
  }

  // Получение статуса парсера
  getStatus() {
    return {
      isConfigured: !!this.config,
      configName: this.config?.name || null,
      targetUrl: this.config?.url || null,
      isActive: this.config?.isActive || false,
      lastParseResult: this.lastParseResult,
      lastParseTime: this.lastParseResult?.parsedAt || null,
      hasDriver: !!this.driver
    };
  }

  // Получение текущей конфигурации парсера
  getConfig() {
    return this.config;
  }

  // Валидация конфига (url и name обязательны)
  validateConfig(config) {
    const errors = [];
    if (!config.url) errors.push('URL обязателен');
    if (!config.name) errors.push('Имя парсера обязательно');
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Тестирование парсера с новым конфигом
  async testParser(testConfig) {
    try {
      await this.setConfig(testConfig);
      const result = await this.parsePage();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Сохранение конфигурации в файл
  async saveConfig() {
    if (!this.config) return;
    try {
      await fs.promises.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      console.log(`💾 Конфигурация парсера сохранена: ${this.config.name}`);
    } catch (error) {
      console.error('❌ Ошибка сохранения конфигурации парсера:', error);
    }
  }

  // Установка конфигурации парсера
  async setConfig(config) {
    this.config = config;
    console.log(`🔧 Настройка Selenium-парсера: ${config.name}`);
    await this.saveConfig();
  }

  // Очистка ресурсов
  async cleanup() {
    await this.closeDriver();
  }
}

// Экспорт единственного экземпляра
const webParserSelenium = new WebParserSelenium();
export default webParserSelenium; 