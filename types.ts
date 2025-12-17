export interface UserProfile {
  id: string; // uuid da tabela profiles
  auth_id: string; // uuid da tabela auth.users
  username: string;
  avatar_url?: string;
  wins: number;
}

export interface GameRoom {
  id: string;
  code: string;
  name: string;
  host_id: string;
  status: 'waiting' | 'in_progress' | 'finished' | 'published' | 'private';
  current_round: number;
  max_players: number;
  created_at: string;
  // Join fields (opcionais dependendo da query)
  host?: {
    username: string;
  };
  player_count?: number; // Calculado no front ou via view
}

export interface GamePlayer {
  id: string;
  game_id: string;
  player_id: string;
  score: number;
  is_czar: boolean;
  profile?: UserProfile;
}

export type CardType = 'black' | 'white';

export interface Card {
  id: string;
  text: string;
  type: CardType;
  status: 'official' | 'pending' | 'approved' | 'rejected';
  created_by?: string;
  created_at?: string;
  creator?: Pick<UserProfile, 'id' | 'username' | 'avatar_url'> | null;
}