import axios from 'axios';
import { supabase } from './supabase';

// URL do Backend Nest.js (ajuste conforme necessário)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para adicionar o token do Supabase nas requisições ao Nest.js
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  
  return config;
});

// Exemplos de métodos para integrar com os Controllers do Nest.js
export const GameService = {
  createGame: async () => {
    return api.post('/games'); // POST http://localhost:3000/games
  },
  joinGame: async (gameId: string) => {
    return api.post(`/games/${gameId}/join`);
  },
  getGameState: async (gameId: string) => {
    return api.get(`/games/${gameId}`);
  }
};