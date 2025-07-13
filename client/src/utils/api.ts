import type { 
  Fight, 
  VoteRequest, 
  VoteCheckRequest, 
  VoteCheckResponse, 
  CreateFightRequest, 
  UpdateFightStatusRequest,
  VoteResults
} from '../types';

// === НОВЫЕ ТИПЫ ДЛЯ MEMORY АРХИТЕКТУРЫ ===

export interface MemoryGameState {
  fight: Fight | null;
  votes: {
    fighter1: number;
    fighter2: number;
    total: number;
  };
  isActive: boolean;
  lastUpdate: string;
  totalUsers: number;
}

export interface MemoryServerStats {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  activeConnections: number;
  totalVotes: number;
  fightsChecked: number;
}

export interface MemoryAdminStats {
  server: MemoryServerStats;
  game: MemoryGameState;
  history: Fight[];
  connections: number;
  externalAPI: {
    lastCheck: string;
    nextCheck: string;
    isHealthy: boolean;
    totalChecks: number;
  };
}

// Автоматическое определение хоста для API
function getAPIBaseURL(): string {
  const hostname = window.location.hostname;
  
  // Если клиент работает на localhost или 127.0.0.1, используем localhost для API
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  
  // Если клиент работает на voter.mardaunt.ru, используем прокси через nginx
  if (hostname === 'voter.mardaunt.ru') {
    return '/api'; // Используем относительный путь для прокси
  }
  
  // Если клиент уже работает на IP адресе, используем тот же IP для API
  return `http://${hostname}:3001/api`;
}

const API_BASE_URL = getAPIBaseURL();

// Utility function for making HTTP requests
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const config = { ...defaultOptions, ...options };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// === НОВЫЕ API ФУНКЦИИ ДЛЯ MEMORY АРХИТЕКТУРЫ ===

export const memoryApi = {
  // Получить текущее состояние игры
  async getCurrent(): Promise<MemoryGameState> {
    const response = await apiRequest<{
      success: boolean;
      fight: Fight | null;
      votes: {
        fighter1_votes: number;
        fighter2_votes: number;
        total_votes: number;
        fighter1_percentage: number;
        fighter2_percentage: number;
        active_users: number;
      };
      isActive: boolean;
      lastUpdate: string;
    }>('/memory/current');
    
    // Маппим данные к ожидаемому формату
    return {
      fight: response.fight,
      votes: {
        fighter1: response.votes.fighter1_votes,
        fighter2: response.votes.fighter2_votes,
        total: response.votes.total_votes,
      },
      isActive: response.isActive,
      lastUpdate: response.lastUpdate,
      totalUsers: response.votes.active_users,
    };
  },

  // Получить статистику голосования
  async getStats(fightId?: string): Promise<VoteResults & { fight_id: string | null }> {
    const endpoint = fightId ? `/memory/stats/${fightId}` : '/memory/stats';
    return apiRequest<VoteResults & { fight_id: string | null }>(endpoint);
  },

  // Отправить голос
  async submitVote(voteData: VoteRequest): Promise<{ vote: any; results: VoteResults }> {
    return apiRequest('/memory', {
      method: 'POST',
      body: JSON.stringify(voteData),
    });
  },

  // Проверить, голосовал ли пользователь
  async checkVoted(checkData: VoteCheckRequest): Promise<VoteCheckResponse & { fight_id: string | null }> {
    return apiRequest<VoteCheckResponse & { fight_id: string | null }>('/memory/check', {
      method: 'POST',
      body: JSON.stringify(checkData),
    });
  },

  // Получить историю боев
  async getHistory(limit: number = 10): Promise<{ fights: Fight[]; total: number }> {
    return apiRequest<{ fights: Fight[]; total: number }>(`/memory/history?limit=${limit}`);
  },

  // Получить статистику сервера (для админов)
  async getServerStats(): Promise<{
    server: MemoryServerStats;
    game: {
      currentFight: string;
      isActive: boolean;
      totalVotes: number;
      activeUsers: number;
    };
  }> {
    return apiRequest<{
      server: MemoryServerStats;
      game: {
        currentFight: string;
        isActive: boolean;
        totalVotes: number;
        activeUsers: number;
      };
    }>('/memory/server-stats');
  },

  // Принудительно завершить текущий бой (админ)
  async endCurrentFight(): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>('/memory/end-fight', {
      method: 'POST',
    });
  },

  // Принудительная проверка внешнего API (админ)
  async forceAPICheck(): Promise<{ success: boolean; message: string; result: any }> {
    return apiRequest<{ success: boolean; message: string; result: any }>('/memory/admin/force-check', {
      method: 'POST',
    });
  },

  // Получить статус внешнего API (админ)
  async getExternalAPIStatus(): Promise<{
    lastCheck: string;
    nextCheck: string;
    isHealthy: boolean;
    totalChecks: number;
  }> {
    return apiRequest<{
      lastCheck: string;
      nextCheck: string;
      isHealthy: boolean;
      totalChecks: number;
    }>('/memory/admin/external-status');
  },

  // === PARSER API FUNCTIONS ===

  // Получить конфигурацию парсера
  async getParserConfig(): Promise<{
    config: any;
    status: any;
  }> {
    return apiRequest<{
      config: any;
      status: any;
    }>('/memory/admin/parser-config');
  },

  // Сохранить конфигурацию парсера
  async saveParserConfig(config: any): Promise<{
    success: boolean;
    message: string;
    config: any;
  }> {
    return apiRequest<{
      success: boolean;
      message: string;
      config: any;
    }>('/memory/admin/parser-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  // Тестирование парсера
  async testParser(config: any): Promise<{
    success: boolean;
    message: string;
    result: any;
  }> {
    return apiRequest<{
      success: boolean;
      message: string;
      result: any;
    }>('/memory/admin/parser-test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  // Получить статус парсера
  async getParserStatus(): Promise<{
    status: any;
  }> {
    return apiRequest<{
      status: any;
    }>('/memory/admin/parser-status');
  },

  // Принудительный запуск парсера
  async runParser(): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    return apiRequest<{
      success: boolean;
      message: string;
      data: any;
    }>('/memory/admin/parser-run', {
      method: 'POST',
    });
  },

  // Получить список источников данных
  async getApiSources(): Promise<{
    success: boolean;
    sources: Array<{
      index: number;
      name: string;
      isActive: boolean;
      url: string;
    }>;
    currentInterval: string;
  }> {
    return apiRequest<{
      success: boolean;
      sources: Array<{
        index: number;
        name: string;
        isActive: boolean;
        url: string;
      }>;
      currentInterval: string;
    }>('/memory/admin/api-sources');
  },

  // Переключить источник данных
  async switchApiSource(sourceIndex: number): Promise<{
    success: boolean;
    message: string;
    currentSource: {
      index: number;
      name: string;
      isActive: boolean;
      url: string;
    };
  }> {
    return apiRequest<{
      success: boolean;
      message: string;
      currentSource: {
        index: number;
        name: string;
        isActive: boolean;
        url: string;
      };
    }>('/memory/admin/switch-source', {
      method: 'POST',
      body: JSON.stringify({ sourceIndex }),
    });
  },
};

// Функция для определения, какой API использовать
export const getActiveAPI = () => {
  // Можно добавить логику определения доступности нового API
  // Пока просто возвращаем memory API
  return memoryApi;
};

// Fight API functions
export const fightsApi = {
  // Get all fights
  async getAll(status?: string, active?: boolean): Promise<Fight[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (active !== undefined) params.append('active', active.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `/fights?${queryString}` : '/fights';
    
    return apiRequest<Fight[]>(endpoint);
  },

  // Get fight by ID
  async getById(id: string): Promise<Fight> {
    return apiRequest<Fight>(`/fights/${id}`);
  },

  // Create new fight
  async create(fightData: CreateFightRequest): Promise<Fight> {
    return apiRequest<Fight>('/fights', {
      method: 'POST',
      body: JSON.stringify(fightData),
    });
  },

  // Update fight status
  async updateStatus(id: string, statusData: UpdateFightStatusRequest): Promise<Fight> {
    return apiRequest<Fight>(`/fights/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(statusData),
    });
  },

  // Activate fight for voting
  async activate(id: string): Promise<Fight> {
    return apiRequest<Fight>(`/fights/${id}/activate`, {
      method: 'PATCH',
    });
  },

  // Deactivate fight
  async deactivate(id: string): Promise<Fight> {
    return apiRequest<Fight>(`/fights/${id}/deactivate`, {
      method: 'PATCH',
    });
  },

  // Get current active fight (проксирует к memory API)
  async getActive(): Promise<Fight | null> {
    try {
      const memoryState = await memoryApi.getCurrent();
      return memoryState.fight;
    } catch (error) {
      // Fallback к старому API
      return apiRequest<Fight | null>('/fights/active/current');
    }
  },
};

// Vote API functions  
export const votesApi = {
  // Get vote results for a fight
  async getResults(fightId: string): Promise<VoteResults> {
    try {
      const memoryStats = await memoryApi.getStats(fightId);
      return {
        fight_id: memoryStats.fight_id || fightId,
        fighter1_votes: memoryStats.fighter1_votes,
        fighter2_votes: memoryStats.fighter2_votes,
        total_votes: memoryStats.total_votes,
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      // Fallback к старому API
      return apiRequest<VoteResults>(`/votes/${fightId}`);
    }
  },

  // Submit a vote
  async submit(voteData: VoteRequest): Promise<{ vote: any; results: VoteResults }> {
    try {
      return await memoryApi.submitVote(voteData);
    } catch (error) {
      // Fallback к старому API
      return apiRequest(`/votes`, {
        method: 'POST',
        body: JSON.stringify(voteData),
      });
    }
  },

  // Check if user has voted
  async checkVoted(checkData: VoteCheckRequest): Promise<VoteCheckResponse> {
    try {
      const result = await memoryApi.checkVoted(checkData);
      return {
        hasVoted: result.hasVoted,
        fighterChoice: result.fighterChoice,
      };
    } catch (error) {
      // Fallback к старому API
      return apiRequest<VoteCheckResponse>('/votes/check', {
        method: 'POST',
        body: JSON.stringify(checkData),
      });
    }
  },
};

// Utility functions
export const utils = {
  // Generate user session ID
  generateUserSession(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${random}`;
  },

  // Get or create user session
  getUserSession(): string {
    const sessionKey = 'ufc_voting_session';
    let session = localStorage.getItem(sessionKey);
    
    if (!session) {
      session = this.generateUserSession();
      localStorage.setItem(sessionKey, session);
    }
    
    return session;
  },

  // Format date for display
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  // Format fight status for display
  formatStatus(status: Fight['status']): string {
    const statusMap = {
      upcoming: 'Предстоящий',
      live: 'В прямом эфире',
      finished: 'Завершен',
      cancelled: 'Отменен',
    };
    return statusMap[status] || status;
  },

  // Calculate vote percentage
  calculatePercentage(votes: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  },

  // Format large numbers
  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  },

  // Debounce function
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Throttle function
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
}; 