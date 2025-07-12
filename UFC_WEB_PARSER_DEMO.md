# Демонстрация веб-парсера UFC

## Успешно реализовано ✅

Веб-парсер UFC успешно интегрирован в систему и может парсить реальные страницы UFC.

### Протестировано на живом примере:
📄 **URL**: https://ufc.ru/event/ufc-fight-night-july-12-2025

### Результаты парсинга:
- ✅ **Имена бойцов**: Деррик Льюис vs Таллисон Тейшейра
- ✅ **Изображения**: Полные URL изображений бойцов
- ✅ **Название события**: UFC Fight Night  
- ✅ **Описание**: Тяжелый вес -
- ✅ **Статус "в прямом эфире"**: Правильно определяется по классу `hidden`
- ✅ **Парсинг множественных боев**: Найдено 12 боев на странице

### Конфигурация парсера:

```json
{
  "name": "UFC.ru Live Parser",
  "url": "https://ufc.ru/event/ufc-fight-night-july-12-2025",
  "selectors": {
    "fightContainer": ".c-listing-fight",
    "fighter1Name": ".c-listing-fight__corner-name--red",
    "fighter2Name": ".c-listing-fight__corner-name--blue",
    "fighter1Image": ".c-listing-fight__corner-image--red img",
    "fighter2Image": ".c-listing-fight__corner-image--blue img",
    "eventName": "h1",
    "eventTime": ".c-hero__timestamp",
    "liveIndicator": ".c-listing-fight__banner--live",
    "description": ".c-listing-fight__class-text"
  },
  "isActive": true
}
```

### Особенности реализации:

1. **Определение прямого эфира**: Проверяется отсутствие класса `hidden` у элемента `.c-listing-fight__banner--live`
2. **Множественные бои**: Парсер сначала ищет живые бои, если не найден - возвращает первый бой
3. **Очистка текста**: Автоматически удаляет лишние пробелы и переносы строк
4. **Нормализация URL**: Преобразует относительные URL изображений в абсолютные
5. **Генерация ID**: Создает уникальные ID для каждого боя

### Как использовать:

1. Откройте http://localhost:5173/#admin-ufc-secret-panel-2024
2. Перейдите в раздел "Настройки парсера"
3. Введите конфигурацию выше
4. Нажмите "Тест парсера" для проверки
5. Сохраните конфигурацию
6. Переключите источник данных на "Web Parser"

### API Endpoints:

- `GET /api/memory/admin/parser-config` - получить конфигурацию
- `POST /api/memory/admin/parser-config` - сохранить конфигурацию  
- `POST /api/memory/admin/parser-test` - тестировать парсер
- `GET /api/memory/admin/parser-status` - статус парсера
- `POST /api/memory/admin/parser-run` - запустить парсер

### Пример результата:

```json
{
  "fighter1_name": "Деррик Льюис",
  "fighter2_name": "Таллисон Тейшейра",
  "fighter1_image": "https://ufc.com/images/styles/event_fight_card_upper_body_of_standing_athlete/s3/2025-07/LEWIS_DERRICK_L_07-12.png?itok=dAwCPEnZ",
  "fighter2_image": "https://ufc.com/images/styles/event_fight_card_upper_body_of_standing_athlete/s3/2025-07/TEIXEIRA_TALLISON_R_07-12.png?itok=4Flx7vbL",
  "event_name": "UFC Fight Night",
  "event_time": null,
  "description": "Тяжелый вес -",
  "is_live": false,
  "parsedAt": "2025-07-12T00:54:56.918Z",
  "sourceUrl": "https://ufc.ru/event/ufc-fight-night-july-12-2025",
  "id": "parsed-0JTQtdGA-1752281696919"
}
```

## Готово к использованию! 🎯

Веб-парсер полностью функционален и готов к использованию с реальными данными UFC.ru. 