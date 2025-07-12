import axios from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';

class WebParser {
  constructor() {
    this.config = null;
    this.lastParseResult = null;
    this.configPath = path.join(process.cwd(), 'ufc-parser-config.json');
    
    // Автоматически загружаем конфигурацию при создании
    this.loadConfig().catch(error => {
      console.error('❌ Ошибка загрузки конфигурации парсера:', error);
    });
  }

  // Загрузка конфигурации из файла
  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      console.log(`📥 Конфигурация парсера загружена: ${this.config.name}`);
    } catch (error) {
      console.log('📝 Файл конфигурации парсера не найден, будет создан при первой настройке');
    }
  }

  // Сохранение конфигурации в файл
  async saveConfig() {
    if (!this.config) return;
    
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      console.log(`💾 Конфигурация парсера сохранена: ${this.config.name}`);
    } catch (error) {
      console.error('❌ Ошибка сохранения конфигурации парсера:', error);
    }
  }

  // Установка конфигурации парсера
  async setConfig(config) {
    this.config = config;
    console.log(`🔧 Настройка парсера: ${config.name}`);
    
    // Автоматически сохраняем конфигурацию
    await this.saveConfig();
  }

  // Получение конфигурации
  getConfig() {
    return this.config;
  }

  // Парсинг страницы с использованием настроенных селекторов
  async parsePage(url = null) {
    const targetUrl = url || this.config?.url;
    
    if (!targetUrl) {
      throw new Error('URL не задан');
    }

    try {
      console.log(`🌐 Парсинг страницы: ${targetUrl}`);
      
      // Загружаем страницу
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      
      // Используем селекторы из конфигурации
      const selectors = this.config?.selectors || {};
      
      // Если есть контейнер для боев, парсим все бои
      if (selectors.fightContainer) {
        return this.parseAllFights($, selectors, targetUrl);
      }
      
      // Иначе парсим как единственный бой
      const result = {
        fighter1_name: this.extractText($, selectors.fighter1Name),
        fighter2_name: this.extractText($, selectors.fighter2Name),
        fighter1_image: this.extractAttribute($, selectors.fighter1Image, 'src'),
        fighter2_image: this.extractAttribute($, selectors.fighter2Image, 'src'),
        event_name: this.extractText($, selectors.eventName),
        event_time: this.extractText($, selectors.eventTime),
        description: this.extractText($, selectors.description),
        is_live: this.checkIsLive($, selectors.liveIndicator),
        parsedAt: new Date().toISOString(),
        sourceUrl: targetUrl
      };

      // Валидация результата
      if (!result.fighter1_name || !result.fighter2_name) {
        throw new Error('Не удалось извлечь имена бойцов');
      }

      // Нормализация URL изображений
      result.fighter1_image = this.normalizeImageUrl(result.fighter1_image, targetUrl);
      result.fighter2_image = this.normalizeImageUrl(result.fighter2_image, targetUrl);

      // Генерация уникального ID для боя
      result.id = this.generateFightId(result.fighter1_name, result.fighter2_name);

      this.lastParseResult = result;
      console.log(`✅ Парсинг успешен: ${result.fighter1_name} vs ${result.fighter2_name}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Ошибка парсинга: ${error.message}`);
      throw error;
    }
  }

  // Парсинг всех боев со страницы
  parseAllFights($, selectors, targetUrl) {
    const fightElements = $(selectors.fightContainer);
    const fights = [];
    
    console.log(`🔍 Найдено ${fightElements.length} боев для парсинга`);
    
    fightElements.each((index, element) => {
      const $fight = $(element);
      
      try {
        const fight = {
          fighter1_name: this.extractTextFromElement($fight, selectors.fighter1Name),
          fighter2_name: this.extractTextFromElement($fight, selectors.fighter2Name),
          fighter1_image: this.extractAttributeFromElement($fight, selectors.fighter1Image, 'src'),
          fighter2_image: this.extractAttributeFromElement($fight, selectors.fighter2Image, 'src'),
          event_name: this.extractText($, selectors.eventName),
          event_time: this.extractText($, selectors.eventTime),
          description: this.extractTextFromElement($fight, selectors.description),
          is_live: this.checkIsLiveFromElement($fight, selectors.liveIndicator),
          parsedAt: new Date().toISOString(),
          sourceUrl: targetUrl
        };
        
        // Проверяем, что удалось извлечь имена бойцов
        if (fight.fighter1_name && fight.fighter2_name) {
          // Нормализация URL изображений
          fight.fighter1_image = this.normalizeImageUrl(fight.fighter1_image, targetUrl);
          fight.fighter2_image = this.normalizeImageUrl(fight.fighter2_image, targetUrl);
          
          // Генерация уникального ID для боя
          fight.id = this.generateFightId(fight.fighter1_name, fight.fighter2_name);
          
          fights.push(fight);
          console.log(`✅ Бой #${index + 1}: ${fight.fighter1_name} vs ${fight.fighter2_name} (Live: ${fight.is_live})`);
        }
      } catch (error) {
        console.warn(`⚠️ Ошибка парсинга боя #${index + 1}: ${error.message}`);
      }
    });
    
    // Ищем первый живой бой
    const liveFight = fights.find(fight => fight.is_live);
    
    if (liveFight) {
      console.log(`🔴 Найден живой бой: ${liveFight.fighter1_name} vs ${liveFight.fighter2_name}`);
      this.lastParseResult = liveFight;
      return liveFight;
    }
    
    // Если нет живых боев, возвращаем первый найденный бой
    if (fights.length > 0) {
      console.log(`📄 Живых боев не найдено, возвращаем первый: ${fights[0].fighter1_name} vs ${fights[0].fighter2_name}`);
      this.lastParseResult = fights[0];
      return fights[0];
    }
    
    throw new Error('Не удалось найти ни одного боя на странице');
  }

  // Извлечение текста по селектору
  extractText($, selector) {
    if (!selector) return null;
    
    try {
      const element = $(selector).first();
      const text = element.text().trim();
      // Очищаем от лишних пробелов и переносов строк
      return text ? text.replace(/\s+/g, ' ').trim() : null;
    } catch (error) {
      console.warn(`⚠️ Ошибка селектора "${selector}": ${error.message}`);
      return null;
    }
  }

  // Извлечение атрибута по селектору
  extractAttribute($, selector, attribute) {
    if (!selector) return null;
    
    try {
      const element = $(selector).first();
      return element.attr(attribute) || null;
    } catch (error) {
      console.warn(`⚠️ Ошибка селектора "${selector}": ${error.message}`);
      return null;
    }
  }

  // Проверка, идет ли бой в прямом эфире
  checkIsLive($, selector) {
    if (!selector) return false;
    
    try {
      const element = $(selector).first();
      // Проверяем, есть ли элемент и НЕ содержит ли он класс "hidden"
      return element.length > 0 && !element.hasClass('hidden');
    } catch (error) {
      console.warn(`⚠️ Ошибка проверки live статуса "${selector}": ${error.message}`);
      return false;
    }
  }

  // Извлечение текста по селектору из конкретного элемента
  extractTextFromElement($element, selector) {
    if (!selector) return null;
    
    try {
      const element = $element.find(selector).first();
      const text = element.text().trim();
      // Очищаем от лишних пробелов и переносов строк
      return text ? text.replace(/\s+/g, ' ').trim() : null;
    } catch (error) {
      console.warn(`⚠️ Ошибка селектора "${selector}": ${error.message}`);
      return null;
    }
  }

  // Извлечение атрибута по селектору из конкретного элемента
  extractAttributeFromElement($element, selector, attribute) {
    if (!selector) return null;
    
    try {
      const element = $element.find(selector).first();
      return element.attr(attribute) || null;
    } catch (error) {
      console.warn(`⚠️ Ошибка селектора "${selector}": ${error.message}`);
      return null;
    }
  }

  // Проверка live статуса из конкретного элемента
  checkIsLiveFromElement($element, selector) {
    if (!selector) return false;
    
    try {
      const element = $element.find(selector).first();
      // Проверяем, есть ли элемент и НЕ содержит ли он класс "hidden"
      return element.length > 0 && !element.hasClass('hidden');
    } catch (error) {
      console.warn(`⚠️ Ошибка проверки live статуса "${selector}": ${error.message}`);
      return false;
    }
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
    const timestamp = Date.now();
    const names = [fighter1, fighter2].sort().join('-');
    const hash = Buffer.from(names).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    return `parsed-${hash.substring(0, 8)}-${timestamp}`;
  }

  // Тестирование парсера с настройками
  async testParser(testConfig) {
    const originalConfig = this.config;
    
    try {
      // Временно устанавливаем тестовую конфигурацию БЕЗ сохранения в файл
      this.config = testConfig;
      
      // Парсим страницу
      const result = await this.parsePage();
      
      return {
        success: true,
        data: result,
        message: 'Парсер работает корректно',
        extractedFields: {
          fighter1_name: !!result.fighter1_name,
          fighter2_name: !!result.fighter2_name,
          fighter1_image: !!result.fighter1_image,
          fighter2_image: !!result.fighter2_image,
          event_name: !!result.event_name,
          event_time: !!result.event_time,
          description: !!result.description,
          is_live: !!result.is_live,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Ошибка при тестировании парсера'
      };
    } finally {
      // Восстанавливаем оригинальную конфигурацию
      this.config = originalConfig;
    }
  }

  // Получение статуса парсера
  getStatus() {
    return {
      isConfigured: !!this.config,
      configName: this.config?.name || null,
      targetUrl: this.config?.url || null,
      isActive: this.config?.isActive || false,
      lastParseResult: this.lastParseResult,
      lastParseTime: this.lastParseResult?.parsedAt || null
    };
  }

  // Валидация конфигурации
  validateConfig(config) {
    const errors = [];
    
    if (!config.name) errors.push('Название парсера обязательно');
    if (!config.url) errors.push('URL страницы обязателен');
    if (!config.selectors) errors.push('Селекторы обязательны');
    
    const selectors = config.selectors || {};
    if (!selectors.fighter1Name) errors.push('Селектор для имени первого бойца обязателен');
    if (!selectors.fighter2Name) errors.push('Селектор для имени второго бойца обязателен');
    if (!selectors.eventName) errors.push('Селектор для названия события обязателен');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Экспорт единственного экземпляра
const webParser = new WebParser();
export default webParser; 