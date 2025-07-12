// Fighter and Fight types
export interface Fighter {
  id: string;
  name: string;
  image?: string;
  country?: string;
  weightClass?: string;
  record?: string;
}

export interface Fight {
  id: string;
  fighter1_name: string;
  fighter2_name: string;
  fighter1_image?: string | null;
  fighter2_image?: string | null;
  event_name: string;
  event_date: string;
  status: 'upcoming' | 'live' | 'finished' | 'cancelled';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  fighter1_votes?: number;
  fighter2_votes?: number;
  total_votes?: number;
}

// Vote types
export interface Vote {
  id: string;
  fight_id: string;
  fighter_choice: 1 | 2;
  user_session: string;
  ip_address: string;
  created_at: string;
}

export interface VoteResults {
  fight_id: string;
  fighter1_votes: number;
  fighter2_votes: number;
  total_votes: number;
  updated_at: string;
}

export interface VoteRequest {
  fight_id: string;
  fighter_choice: 1 | 2;
  user_session: string;
}

export interface VoteCheckRequest {
  fight_id: string;
  user_session: string;
}

export interface VoteCheckResponse {
  hasVoted: boolean;
  fighterChoice?: 1 | 2;
}

// Socket.io event types
export interface SocketEvents {
  // Client to server
  get_active_fight: () => void;
  get_all_fights: () => void;
  get_fight: (fightId: string) => void;
  subscribe_to_fight: (fightId: string) => void;
  unsubscribe_from_fight: (fightId: string) => void;
  subscribe_admin: () => void;
  unsubscribe_admin: () => void;
  ping: () => void;

  // Server to client
  active_fight: (fight: Fight | null) => void;
  all_fights: (fights: Fight[]) => void;
  fight_data: (fight: Fight) => void;
  vote_results: (data: { fight_id: string; results: VoteResults }) => void;
  fight_created: (fight: Fight) => void;
  fight_updated: (fight: Fight) => void;
  fight_activated: (fight: Fight) => void;
  fight_deactivated: (fight: Fight) => void;
  active_fight_changed: (fight: Fight | null) => void;
  vote_added: (data: { fight_id: string; results: VoteResults; fight: Fight }) => void;
  vote_update: (data: { fight_id: string; results: VoteResults; fight: Fight }) => void;
  connection_stats: (stats: ConnectionStats) => void;
  error: (error: { message: string }) => void;
  pong: () => void;
}

// UI State types
export interface AppState {
  activeFight: Fight | null;
  allFights: Fight[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
}

export interface VotingState {
  hasVoted: boolean;
  selectedFighter: 1 | 2 | null;
  isVoting: boolean;
  voteResults: VoteResults | null;
}

// Admin types
export interface ConnectionStats {
  total: number;
  admin: number;
  regular: number;
}

export interface CreateFightRequest {
  fighter1_name: string;
  fighter2_name: string;
  fighter1_image?: string;
  fighter2_image?: string;
  event_name?: string;
  event_date?: string;
}

export interface UpdateFightStatusRequest {
  status?: 'upcoming' | 'live' | 'finished' | 'cancelled';
  is_active?: boolean;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  error: string;
  details?: any;
}

// Hook types
export interface UseSocketReturn {
  socket: any;
  isConnected: boolean;
  error: string | null;
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
}

export interface UseVotingReturn {
  vote: (fightId: string, fighterChoice: 1 | 2) => Promise<void>;
  checkVoteStatus: (fightId: string) => Promise<VoteCheckResponse>;
  votingState: VotingState;
  resetVotingState: () => void;
}

// Component props types
export interface VotingWidgetProps {
  fight: Fight;
  onVote?: (fighterChoice: 1 | 2) => void;
  className?: string;
}

export interface FighterCardProps {
  name: string;
  image?: string | null;
  votes: number;
  totalVotes: number;
  isSelected: boolean;
  hasVoted: boolean;
  isVoting: boolean;
  onClick: () => void;
  className?: string;
}

export interface AdminPanelProps {
  className?: string;
}

export interface FightListProps {
  fights: Fight[];
  onFightSelect?: (fight: Fight) => void;
  onFightActivate?: (fightId: string) => void;
  onFightDeactivate?: (fightId: string) => void;
  className?: string;
}

// Utility types
export type FightStatus = Fight['status'];
export type FighterChoice = 1 | 2;
export type UserSession = string; 