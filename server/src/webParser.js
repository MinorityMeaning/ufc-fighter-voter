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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
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
        is_live: this.checkIsLive($('body'), selectors.liveIndicator),
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
    
    // Сначала собираем все элементы .c-listing-fight в список
    const fightElementList = [];
    fightElements.each((index, element) => {
      const $element = $(element);
      fightElementList.push($element);
      console.log(`📋 Элемент #${index + 1}: ${$element.attr('class') || 'no-class'}`);
    });
    
    console.log(`📋 Собрано ${fightElementList.length} элементов боев`);
    
    // Теперь извлекаем информацию из каждого элемента
    fightElementList.forEach(($fight, index) => {
      try {
        const fighter1Name = this.extractTextFromElement($fight, selectors.fighter1Name);
        const fighter2Name = this.extractTextFromElement($fight, selectors.fighter2Name);
        
        console.log(`🔍 Извлекаем бой #${index + 1}: ${fighter1Name} vs ${fighter2Name}`);
        
        // Проверяем наличие элемента с результатом боя
        const outcomeElement = $fight.find('.c-listing-fight__outcome--win');
        const hasOutcome = outcomeElement.length > 0;
        
        console.log(`🔍 Бой #${index + 1}: ${fighter1Name} vs ${fighter2Name} - outcome элемент: ${hasOutcome ? 'ЕСТЬ' : 'НЕТ'}`);
        
        const fight = {
          fighter1_name: fighter1Name,
          fighter2_name: fighter2Name,
          fighter1_image: this.extractAttributeFromElement($fight, selectors.fighter1Image, 'src'),
          fighter2_image: this.extractAttributeFromElement($fight, selectors.fighter2Image, 'src'),
          event_name: this.extractText($, selectors.eventName),
          event_time: this.extractText($, selectors.eventTime),
          description: this.extractTextFromElement($fight, selectors.description),
          is_live: this.checkIsLive($fight, selectors.liveIndicator),
          has_outcome: hasOutcome,
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
          console.log(`✅ Бой #${index + 1}: ${fight.fighter1_name} vs ${fight.fighter2_name} (живой: ${fight.is_live ? 'ДА' : 'НЕТ'})`);
        } else {
          console.log(`❌ Бой #${index + 1}: Не удалось извлечь имена (${fighter1Name} vs ${fighter2Name})`);
        }
      } catch (error) {
        console.warn(`⚠️ Ошибка парсинга боя #${index + 1}: ${error.message}`);
      }
    });
    
    console.log(`📊 Извлечено ${fights.length} боев из ${fightElementList.length} элементов`);
    
    // Проверяем live статус на уровне всей страницы
    const allLiveBanners = $('.c-listing-fight__banner--live');
    const visibleLiveBanners = $('.c-listing-fight__banner--live:not(.hidden)');
    const hasGlobalLive = visibleLiveBanners.length > 0;
    
    console.log(`🔍 Все live banner'ы: ${allLiveBanners.length}`);
    console.log(`🔍 Видимые live banner'ы: ${visibleLiveBanners.length}`);
    console.log(`🔍 Глобальный live banner: ${hasGlobalLive ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
    
    if (allLiveBanners.length > 0) {
      console.log(`🔍 Первый live banner:`, allLiveBanners.first().toString());
    }
    
    if (hasGlobalLive) {
      console.log(`🔍 Видимый live banner:`, visibleLiveBanners.first().toString());
    }
    
    // Попробуем найти другие возможные live индикаторы
    const otherLiveIndicators = $('[class*="live"], [class*="Live"], [class*="LIVE"]');
    console.log(`🔍 Другие live индикаторы: ${otherLiveIndicators.length}`);
    if (otherLiveIndicators.length > 0) {
      otherLiveIndicators.each((i, el) => {
        const $el = $(el);
        console.log(`🔍 Live индикатор ${i+1}:`, $el.toString());
      });
    }
    
    // Возвращаем первый бой (живой или нет)
    if (fights.length > 0) {
      const selectedFight = fights[0];
      
      // Если есть глобальный live banner, помечаем бой как live
      if (hasGlobalLive) {
        selectedFight.is_live = true;
        console.log(`📄 Возвращаем бой: ${selectedFight.fighter1_name} vs ${selectedFight.fighter2_name} (живой: ДА - глобальный индикатор)`);
      } else {
        console.log(`📄 Возвращаем бой: ${selectedFight.fighter1_name} vs ${selectedFight.fighter2_name} (живой: НЕТ)`);
      }
      
      this.lastParseResult = selectedFight;
      return selectedFight;
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
  checkIsLive($element, selector) {
    if (!selector) return false;
    
    try {
      // Ищем live banner в элементе боя
      const liveBanner = $element.find(selector);
      
      console.log(`🔍 Live banner поиск: селектор="${selector}", найдено=${liveBanner.length}`);
      
      if (liveBanner.length > 0) {
        const hasHidden = liveBanner.hasClass('hidden');
        const textContent = liveBanner.text().trim();
        const allClasses = liveBanner.attr('class') || '';
        
        console.log(`🔍 Live banner найден:`);
        console.log(`   - Классы: "${allClasses}"`);
        console.log(`   - Hidden: ${hasHidden}`);
        console.log(`   - Текст: "${textContent}"`);
        
        // Если элемент НЕ скрыт и содержит live текст
        if (!hasHidden && (textContent.toLowerCase().includes('live') || textContent.toLowerCase().includes('прямой эфир'))) {
          console.log(`   - Результат: LIVE (видимый banner с live текстом)`);
          return true;
        }
      }
      
      // Если не нашли видимый banner в элементе, проверяем глобальные live индикаторы
      // Нужно искать на уровне всей страницы, а не внутри элемента боя
      let globalLiveIndicators = $element.find('.c-listing-ticker-fightcard__live');
      
      // Если не нашли в элементе боя, ищем на уровне всей страницы
      if (globalLiveIndicators.length === 0) {
        const $body = $element.closest('body');
        if ($body.length > 0) {
          globalLiveIndicators = $body.find('.c-listing-ticker-fightcard__live');
        }
      }
      
      console.log(`🔍 Глобальные live индикаторы: найдено=${globalLiveIndicators.length}`);
      
      if (globalLiveIndicators.length > 0) {
        // Проверяем первый индикатор
        const firstIndicator = globalLiveIndicators.first();
        const indicatorText = firstIndicator.text().trim();
        const indicatorClasses = firstIndicator.attr('class') || '';
        
        console.log(`🔍 Глобальный live индикатор:`);
        console.log(`   - Классы: "${indicatorClasses}"`);
        console.log(`   - Текст: "${indicatorText}"`);
        
        // Если есть глобальный live индикатор, считаем что есть live бой
        if (indicatorText.toLowerCase().includes('live')) {
          console.log(`   - Результат: LIVE (найден глобальный live индикатор)`);
          return true;
        }
      }
      
      console.log(`🔍 Live статус: НЕ live`);
      return false;
    } catch (error) {
      console.warn(`⚠️ Ошибка проверки live статуса: ${error.message}`);
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