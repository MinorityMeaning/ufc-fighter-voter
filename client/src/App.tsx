import { useState, useEffect, useRef } from 'react';
import { VotingWidget } from './components/VotingWidget';
import { AdminPanel } from './components/AdminPanel';
import { io, Socket } from 'socket.io-client';

const ADMIN_SECRET_HASH = '#admin-ufc-secret-panel-2024';

interface Fight {
  id: string;
  fighter1_name: string;
  fighter2_name: string;
  event_name?: string;
  fighter1_image?: string;
  fighter2_image?: string;
  fighter1_votes?: number;
  fighter2_votes?: number;
  total_votes?: number;
  is_active?: boolean;
}

interface VoteStats {
  fighter1: number;
  fighter2: number;
  total: number;
}

function App() {
  const [mode, setMode] = useState<'voting' | 'admin'>('voting');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentFight, setCurrentFight] = useState<Fight | null>(null);
  const [voteStats, setVoteStats] = useState<VoteStats>({ fighter1: 0, fighter2: 0, total: 0 });
  const socketRef = useRef<Socket | null>(null);

  // Генерируем user_session при загрузке
  useEffect(() => {
    if (!localStorage.getItem('ufc_user_session')) {
      const session = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('ufc_user_session', session);
    }
  }, []);

  // Check for admin access
  useEffect(() => {
    if (window.location.hash === ADMIN_SECRET_HASH) {
      setMode('admin');
    }
  }, []);

  // Socket connection
  useEffect(() => {
    // Закрываем предыдущее соединение, если оно есть
    if (socketRef.current) {
      socketRef.current.close();
    }

    // В development используем прокси Vite, в production - относительный путь
    const socketUrl = import.meta.env.MODE === 'development' 
      ? '/' 
      : window.location.origin;
    
    const newSocket = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('current_state', (data: { fight: Fight; votes: VoteStats }) => {
      console.log('Received current state:', data);
      setCurrentFight(data.fight);
      setVoteStats(data.votes);
    });

    newSocket.on('vote_results', (data: { results: VoteStats }) => {
      console.log('Received vote results:', data);
      setVoteStats(data.results);
      
      // Update current fight with new vote data
      setCurrentFight(prev => prev ? {
        ...prev,
        fighter1_votes: data.results.fighter1,
        fighter2_votes: data.results.fighter2,
        total_votes: data.results.total
      } : null);
    });

    newSocket.on('vote_added', (data: { results: VoteStats }) => {
      console.log('Vote added:', data);
      // Update vote stats when a new vote is added
      setVoteStats(data.results);
      
      setCurrentFight(prev => prev ? {
        ...prev,
        fighter1_votes: data.results.fighter1,
        fighter2_votes: data.results.fighter2,
        total_votes: data.results.total
      } : null);
    });

    newSocket.on('vote_confirmed', (data: { success: boolean; fighter_choice: number; results: VoteStats }) => {
      console.log('Vote confirmed:', data);
      // Обновляем статистику при подтверждении голоса
      setVoteStats(data.results);
      
      setCurrentFight(prev => prev ? {
        ...prev,
        fighter1_votes: data.results.fighter1,
        fighter2_votes: data.results.fighter2,
        total_votes: data.results.total
      } : null);
    });

    newSocket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      // Можно добавить уведомление пользователю об ошибке
      alert(`Ошибка: ${data.message}`);
    });

    newSocket.on('new_fight_started', (data: { fight: Fight; votes: VoteStats }) => {
      console.log('New fight started:', data);
      setCurrentFight(data.fight);
      setVoteStats(data.votes);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      if (newSocket.connected) {
        newSocket.close();
      } else {
        // Если соединение еще не установлено, просто отключаем все обработчики
        newSocket.removeAllListeners();
      }
    };
  }, []); // УБРАЛИ ЗАВИСИМОСТЬ currentFight

  const handleVote = (fighter: 1 | 2) => {
    if (socketRef.current && currentFight) {
      console.log(`Voting for fighter ${fighter}`);
      socketRef.current.emit('vote', { 
        fight_id: currentFight.id,
        fighter_choice: fighter,
        user_session: localStorage.getItem('ufc_user_session') || 'anonymous'
      });
    }
  };

  if (mode === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <AdminPanel />
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-16 h-16 mx-auto mb-6"></div>
          <h2 className="text-3xl font-display font-bold text-white mb-4 text-shadow">
            Подключение к серверу
          </h2>
          <p className="text-xl text-gray-400 mb-2">Пожалуйста, подождите...</p>
          <p className="text-sm text-gray-500">Устанавливаем соединение с UFC сервером</p>
        </div>
      </div>
    );
  }

  if (!currentFight) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <div className="card p-12 shadow-2xl">
            <div className="text-8xl mb-6">🥊</div>
            <h2 className="text-4xl font-display font-bold text-white mb-4 text-shadow">
              UFC Виджет Голосования
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              В данный момент нет активных боев для голосования.
            </p>
            <div className="bg-gradient-to-r from-ufc-red/20 to-ufc-gold/20 rounded-xl p-6 border border-ufc-red/30">
              <p className="text-ufc-gold font-medium mb-2">📡 Статус системы</p>
              <p className="text-sm text-gray-300">
                Виджет автоматически обновится при активации боя
              </p>
            </div>
            <div className="mt-8 text-xs text-gray-500">
              <p>Реальное время • Автоматическое обновление • WebSocket соединение активно</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Merge current fight with vote stats
  const fightWithVotes: Fight = {
    ...currentFight,
    fighter1_votes: voteStats.fighter1,
    fighter2_votes: voteStats.fighter2,
    total_votes: voteStats.total
  };

  return (
    <VotingWidget 
      fight={fightWithVotes}
      onVote={handleVote}
    />
  );
}

export default App; 