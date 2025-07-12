import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Activity,
  Users,
  Calendar,
  Wifi,
  WifiOff,
  RefreshCw,
  StopCircle,
  Clock,
  MemoryStick,
  Zap,
  Globe,
  Settings,
  Save,
  TestTube,
  Play,
  Code
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { memoryApi, utils } from '../utils/api';
import type { MemoryGameState, MemoryServerStats } from '../utils/api';
import type { Fight } from '../types';

interface AdminStats {
  server: MemoryServerStats;
  game: {
    currentFight: string;
    isActive: boolean;
    totalVotes: number;
    activeUsers: number;
  };
}

interface ExternalAPIStatus {
  lastCheck: string;
  nextCheck: string;
  isHealthy: boolean;
  totalChecks: number;
}

interface ApiSource {
  index: number;
  name: string;
  isActive: boolean;
  url: string;
}

// Интерфейс для настройки парсинга
interface ParserConfig {
  name: string;
  url: string;
  selectors: {
    fightContainer?: string;
    fighter1Name: string;
    fighter2Name: string;
    fighter1Image: string;
    fighter2Image: string;
    eventName: string;
    eventTime?: string;
    description?: string;
    liveIndicator?: string;
  };
  isActive: boolean;
  lastTest?: string;
  testResult?: {
    success: boolean;
    data?: any;
    error?: string;
  };
}

// Компонент для настройки парсинга
const ParserConfigCard: React.FC<{
  config: ParserConfig | null;
  onSave: (config: ParserConfig) => void;
  onTest: (config: ParserConfig) => void;
  onRun: () => void;
  isLoading: boolean;
}> = ({ config, onSave, onTest, onRun, isLoading }) => {
  const [formData, setFormData] = useState<ParserConfig>({
    name: '',
    url: '',
    selectors: {
      fightContainer: '',
      fighter1Name: '',
      fighter2Name: '',
      fighter1Image: '',
      fighter2Image: '',
      eventName: '',
      eventTime: '',
      description: '',
      liveIndicator: ''
    },
    isActive: false
  });

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleTest = () => {
    onTest(formData);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Settings className="w-6 h-6 text-blue-400" />
          <div>
            <h3 className="text-xl font-bold text-white">Настройка парсинга</h3>
            <p className="text-gray-400 text-sm">Настройте парсер для получения данных о боях</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${formData.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
            <span className="text-sm text-gray-400">
              {formData.isActive ? 'Активен' : 'Неактивен'}
            </span>
          </div>
          <button
            type="button"
            onClick={onRun}
            disabled={isLoading || !formData.isActive}
            className={`btn btn-primary flex items-center space-x-2 ${isLoading || !formData.isActive ? 'btn-disabled' : ''}`}
          >
            <Play className="w-4 h-4" />
            <span>Запустить</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Название парсера
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="UFC Main Event Parser"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              URL страницы
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({...formData, url: e.target.value})}
              placeholder="https://www.ufc.com/events"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Code className="w-5 h-5 text-purple-400" />
            <h4 className="text-lg font-medium text-white">CSS Селекторы</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Контейнер боев (опционально)
              </label>
              <input
                type="text"
                value={formData.selectors.fightContainer || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  selectors: {...formData.selectors, fightContainer: e.target.value}
                })}
                placeholder=".fight-container"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                Селектор для контейнера, содержащего все бои. Если не указан, парсится единственный бой на странице.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Имя первого бойца
              </label>
              <input
                type="text"
                value={formData.selectors.fighter1Name}
                onChange={(e) => setFormData({
                  ...formData,
                  selectors: {...formData.selectors, fighter1Name: e.target.value}
                })}
                placeholder=".fighter-1 .name"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Имя второго бойца
              </label>
              <input
                type="text"
                value={formData.selectors.fighter2Name}
                onChange={(e) => setFormData({
                  ...formData,
                  selectors: {...formData.selectors, fighter2Name: e.target.value}
                })}
                placeholder=".fighter-2 .name"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Изображение первого бойца
              </label>
              <input
                type="text"
                value={formData.selectors.fighter1Image}
                onChange={(e) => setFormData({
                  ...formData,
                  selectors: {...formData.selectors, fighter1Image: e.target.value}
                })}
                placeholder=".fighter-1 img"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Изображение второго бойца
              </label>
              <input
                type="text"
                value={formData.selectors.fighter2Image}
                onChange={(e) => setFormData({
                  ...formData,
                  selectors: {...formData.selectors, fighter2Image: e.target.value}
                })}
                placeholder=".fighter-2 img"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Название события
              </label>
              <input
                type="text"
                value={formData.selectors.eventName}
                onChange={(e) => setFormData({
                  ...formData,
                  selectors: {...formData.selectors, eventName: e.target.value}
                })}
                placeholder=".event-title"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Время события (опционально)
              </label>
              <input
                type="text"
                value={formData.selectors.eventTime || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  selectors: {...formData.selectors, eventTime: e.target.value}
                })}
                placeholder=".event-time"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Описание (опционально)
              </label>
              <input
                type="text"
                value={formData.selectors.description || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  selectors: {...formData.selectors, description: e.target.value}
                })}
                placeholder=".fight-description"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Индикатор "В прямом эфире" (опционально)
              </label>
              <input
                type="text"
                value={formData.selectors.liveIndicator || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  selectors: {...formData.selectors, liveIndicator: e.target.value}
                })}
                placeholder=".live-indicator"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                Элемент с классом `hidden` означает, что бой НЕ идет в прямом эфире
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-white">Активировать парсер</span>
          </label>
        </div>

        <div className="flex items-center space-x-4 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className={`btn btn-primary flex items-center space-x-2 ${isLoading ? 'btn-disabled' : ''}`}
          >
            <Save className="w-4 h-4" />
            <span>Сохранить</span>
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={isLoading || !formData.url}
            className={`btn btn-secondary flex items-center space-x-2 ${isLoading || !formData.url ? 'btn-disabled' : ''}`}
          >
            <TestTube className="w-4 h-4" />
            <span>Тест парсера</span>
          </button>
        </div>

        {/* Результат теста */}
        {formData.testResult && (
          <div className={`mt-4 p-4 rounded-lg ${formData.testResult.success ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
            <h4 className={`font-medium mb-2 ${formData.testResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {formData.testResult.success ? '✅ Парсер работает' : '❌ Ошибка парсера'}
            </h4>
            {formData.testResult.success && formData.testResult.data && (
              <div className="space-y-2 text-sm">
                <div className="text-gray-300">
                  <strong>Найденные данные:</strong>
                </div>
                <pre className="bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(formData.testResult.data, null, 2)}
                </pre>
              </div>
            )}
            {formData.testResult.error && (
              <div className="text-red-400 text-sm">
                <strong>Ошибка:</strong> {formData.testResult.error}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}> = ({ title, value, subtitle, icon, color = 'primary' }) => {
  const colorClasses = {
    primary: 'border-ufc-red/20 bg-ufc-red/5',
    success: 'border-green-500/20 bg-green-500/5',
    warning: 'border-yellow-500/20 bg-yellow-500/5',
    danger: 'border-red-500/20 bg-red-500/5',
  };

  return (
    <div className={`card p-4 ${colorClasses[color]}`}>
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-gray-700/50">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-sm text-gray-400">{title}</div>
          <div className="text-xl font-bold text-white">{value}</div>
          {subtitle && (
            <div className="text-xs text-gray-500">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const CurrentFightCard: React.FC<{
  gameState: MemoryGameState | null;
  onEndFight: () => void;
  isLoading: boolean;
}> = ({ gameState, onEndFight, isLoading }) => {
  if (!gameState?.fight) {
    return (
      <div className="card p-6 border-yellow-500/20">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-3 h-3 bg-yellow-400 rounded-full" />
          <h3 className="text-lg font-bold text-white">Нет активного боя</h3>
        </div>
        <p className="text-gray-400 mb-4">
          Система ожидает нового боя от внешнего API
        </p>
        <div className="text-sm text-yellow-400">
          ⏳ Следующая проверка через несколько минут...
        </div>
      </div>
    );
  }

  const { fight, votes, isActive } = gameState;

  return (
    <div className={`card p-6 ${isActive ? 'border-ufc-red shadow-glow' : 'border-gray-600'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-bold text-white">
              {fight.fighter1_name} vs {fight.fighter2_name}
            </h3>
            {isActive && (
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          
          <div className="space-y-1 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>{fight.event_name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Голосов: {utils.formatNumber(votes.total)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span className={isActive ? 'text-green-400' : 'text-gray-400'}>
                {isActive ? 'Активен' : 'Неактивен'}
              </span>
            </div>
          </div>
        </div>

        {isActive && (
          <button
            onClick={onEndFight}
            disabled={isLoading}
            className={`btn btn-secondary flex items-center space-x-2 ${isLoading ? 'btn-disabled' : ''}`}
          >
            <StopCircle className="w-4 h-4" />
            <span>Завершить бой</span>
          </button>
        )}
      </div>

      {/* Результаты голосования */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-ufc-gold">
            {utils.formatNumber(votes.fighter1)}
          </div>
          <div className="text-sm text-gray-400">
            {fight.fighter1_name}
          </div>
          <div className="text-sm text-gray-500">
            {utils.calculatePercentage(votes.fighter1, votes.total)}%
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-ufc-gold">
            {utils.formatNumber(votes.fighter2)}
          </div>
          <div className="text-sm text-gray-400">
            {fight.fighter2_name}
          </div>
          <div className="text-sm text-gray-500">
            {utils.calculatePercentage(votes.fighter2, votes.total)}%
          </div>
        </div>
      </div>
    </div>
  );
};

const FightHistoryCard: React.FC<{ history: Fight[] }> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-bold text-white mb-4">История боев</h3>
        <p className="text-gray-400">Нет завершённых боев</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-bold text-white mb-4">
        История боев ({history.length})
      </h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {history.map((fight) => (
          <div key={fight.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
            <div>
              <div className="text-white font-medium">
                {fight.fighter1_name} vs {fight.fighter2_name}
              </div>
              <div className="text-sm text-gray-400">
                {fight.event_name} • {utils.formatNumber(fight.total_votes || 0)} голосов
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {utils.formatDate(fight.updated_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdminPanel: React.FC = () => {
  const { isConnected } = useSocket();
  const [gameState, setGameState] = useState<MemoryGameState | null>(null);
  const [serverStats, setServerStats] = useState<AdminStats | null>(null);
  const [apiStatus, setApiStatus] = useState<ExternalAPIStatus | null>(null);
  const [history, setHistory] = useState<Fight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [parserConfig, setParserConfig] = useState<ParserConfig | null>(null);
  const [apiSources, setApiSources] = useState<ApiSource[]>([]);
  const [currentInterval, setCurrentInterval] = useState<string>('');

  // Загрузка данных
  const loadData = useCallback(async () => {
    try {
      const [currentState, stats, externalStatus, fightHistory, parserData, sourcesData] = await Promise.all([
        memoryApi.getCurrent(),
        memoryApi.getServerStats(),
        memoryApi.getExternalAPIStatus(),
        memoryApi.getHistory(10),
        memoryApi.getParserConfig().catch(() => ({ config: null, status: null })),
        memoryApi.getApiSources().catch(() => ({ sources: [], currentInterval: '' }))
      ]);

      console.log('🔍 Loaded admin data:', { currentState, stats, externalStatus, fightHistory, parserData, sourcesData });
      
      setGameState(currentState);
      setServerStats(stats);
      setApiStatus(externalStatus);
      setParserConfig(parserData.config);
      setApiSources(sourcesData.sources || []);
      setCurrentInterval(sourcesData.currentInterval || '');
      
      // Удаляем дубликаты из истории по ID
      const uniqueFights = fightHistory.fights.filter((fight, index, self) => 
        index === self.findIndex(f => f.id === fight.id)
      );
      setHistory(uniqueFights);
      setLastUpdate(new Date().toISOString());
    } catch (error: any) {
      console.error('Error loading admin data:', error);
      toast.error(error.message || 'Ошибка загрузки данных');
    }
  }, []);

  // Обработчики для парсера
  const handleSaveParser = useCallback(async (config: ParserConfig) => {
    setIsLoading(true);
    try {
      const result = await memoryApi.saveParserConfig(config);
      setParserConfig(result.config);
      toast.success('Конфигурация парсера сохранена');
    } catch (error: any) {
      console.error('Error saving parser config:', error);
      toast.error(error.message || 'Ошибка сохранения конфигурации');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTestParser = useCallback(async (config: ParserConfig) => {
    setIsLoading(true);
    try {
      const result = await memoryApi.testParser(config);
      
      // Обновляем конфигурацию с результатом теста
      const updatedConfig = {
        ...config,
        testResult: result.result,
        lastTest: new Date().toISOString()
      };
      
      setParserConfig(updatedConfig);
      
      if (result.result.success) {
        toast.success('Парсер работает корректно');
      } else {
        toast.error('Ошибка при тестировании парсера');
      }
    } catch (error: any) {
      console.error('Error testing parser:', error);
      toast.error(error.message || 'Ошибка тестирования парсера');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRunParser = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await memoryApi.runParser();
      toast.success('Парсер успешно выполнен');
      loadData(); // Перезагружаем данные
    } catch (error: any) {
      console.error('Error running parser:', error);
      toast.error(error.message || 'Ошибка выполнения парсера');
    } finally {
      setIsLoading(false);
    }
  }, [loadData]);

  // Принудительное завершение боя
  const handleEndFight = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await memoryApi.endCurrentFight();
      toast.success(result.message);
      loadData(); // Перезагружаем данные
    } catch (error: any) {
      console.error('Error ending fight:', error);
      toast.error(error.message || 'Ошибка завершения боя');
    } finally {
      setIsLoading(false);
    }
  }, [loadData]);

  // Принудительная проверка API
  const handleForceAPICheck = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await memoryApi.forceAPICheck();
      toast.success(result.message);
      loadData(); // Перезагружаем данные
    } catch (error: any) {
      console.error('Error forcing API check:', error);
      toast.error(error.message || 'Ошибка проверки API');
    } finally {
      setIsLoading(false);
    }
  }, [loadData]);

  // Переключение источника данных
  const handleSwitchApiSource = useCallback(async (sourceIndex: number) => {
    setIsLoading(true);
    try {
      const result = await memoryApi.switchApiSource(sourceIndex);
      toast.success(result.message);
      loadData(); // Перезагружаем данные
    } catch (error: any) {
      console.error('Error switching API source:', error);
      toast.error(error.message || 'Ошибка переключения источника данных');
    } finally {
      setIsLoading(false);
    }
  }, [loadData]);

  // Автообновление данных каждые 30 секунд
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Форматирование времени работы сервера
  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}ч ${minutes}м`;
  };

  // Форматирование памяти
  const formatMemory = (bytes: number): string => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Панель администратора</h1>
          <p className="text-gray-400 mt-1">Memory-based архитектура UFC виджета</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-400">
            Обновлено: {lastUpdate ? utils.formatDate(lastUpdate) : 'Никогда'}
          </div>
          
          <button
            onClick={loadData}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Обновить</span>
          </button>

          <button
            onClick={handleForceAPICheck}
            disabled={isLoading}
            className={`btn btn-primary flex items-center space-x-2 ${isLoading ? 'btn-disabled' : ''}`}
          >
            <Globe className="w-4 h-4" />
            <span>Проверить API</span>
          </button>
        </div>
      </div>

      {/* Connection status */}
      <div className={`card p-4 ${isConnected ? 'border-green-500' : 'border-red-500'}`}>
        <div className="flex items-center space-x-2">
          {isConnected ? <Wifi className="w-5 h-5 text-green-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? 'Подключено к серверу' : 'Нет соединения с сервером'}
          </span>
        </div>
      </div>

      {/* Server Statistics */}
      {serverStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Время работы"
            value={formatUptime(serverStats.server.uptime)}
            icon={<Clock className="w-5 h-5 text-blue-400" />}
          />
          <StatCard
            title="Память"
            value={formatMemory(serverStats.server.memory.used)}
            subtitle={`${serverStats.server.memory.percentage}% от ${formatMemory(serverStats.server.memory.total)}`}
            icon={<MemoryStick className="w-5 h-5 text-purple-400" />}
            color={serverStats.server.memory.percentage > 80 ? 'warning' : 'primary'}
          />
          <StatCard
            title="Подключений"
            value={serverStats.server.activeConnections}
            icon={<Users className="w-5 h-5 text-green-400" />}
          />
          <StatCard
            title="Всего голосов"
            value={utils.formatNumber(serverStats.game.totalVotes)}
            icon={<Zap className="w-5 h-5 text-yellow-400" />}
          />
        </div>
      )}

      {/* External API Status */}
      {apiStatus && (
        <div className={`card p-4 ${apiStatus.isHealthy ? 'border-green-500/20' : 'border-red-500/20'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${apiStatus.isHealthy ? 'bg-green-400' : 'bg-red-400'}`} />
              <div>
                <h3 className="text-white font-medium">Внешний API</h3>
                <p className="text-sm text-gray-400">
                  Проверок: {apiStatus.totalChecks} • 
                  Последняя: {utils.formatDate(apiStatus.lastCheck)} •
                  Интервал: {currentInterval}
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              Следующая: {utils.formatDate(apiStatus.nextCheck)}
            </div>
          </div>
        </div>
      )}

      {/* API Sources */}
      {apiSources.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Globe className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-white font-medium">Источники данных</h3>
                <p className="text-sm text-gray-400">Автоматическая проверка каждые {currentInterval}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {apiSources.map((source) => (
              <div
                key={source.index}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  source.isActive 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                }`}
                onClick={() => !source.isActive && !isLoading && handleSwitchApiSource(source.index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${source.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                    <span className={`font-medium ${source.isActive ? 'text-green-400' : 'text-white'}`}>
                      {source.name}
                    </span>
                  </div>
                  {source.isActive && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                      Активен
                    </span>
                  )}
                </div>
                {source.url !== 'mock' && source.url !== 'web-parser' && (
                  <div className="text-xs text-gray-400 mt-1 truncate">
                    {source.url}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parser Configuration */}
      <ParserConfigCard
        config={parserConfig}
        onSave={handleSaveParser}
        onTest={handleTestParser}
        onRun={handleRunParser}
        isLoading={isLoading}
      />

      {/* Current Fight */}
      <CurrentFightCard
        gameState={gameState}
        onEndFight={handleEndFight}
        isLoading={isLoading}
      />

      {/* Fight History */}
      <FightHistoryCard history={history} />
    </div>
  );
}; 