'use client';

import React, { useState, useEffect, useRef } from 'react';
import animeBase from 'animejs';
import Button from '../../components/Button';
import { useRouter } from 'next/navigation';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { GameRoom } from '../../types';

export default function GameHub() {
  const [games, setGames] = useState<GameRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { profile, user, loading: authLoading } = useAuth();
  
  useEffect(() => {
    if (!authLoading && user) {
        if (!profile || !profile.username) {
            router.push('/setup-profile');
        }
    } else if (!authLoading && !user) {
        router.push('/login');
    }
  }, [user, profile, authLoading, router]);

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select(`*, host:profiles(username)`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const gamesWithCounts = await Promise.all(data.map(async (game: any) => {
         const { count } = await supabase.from('game_players').select('*', { count: 'exact', head: true }).eq('game_id', game.id);
         return {
            ...game,
            host: game.host, 
            player_count: count || 0
         };
      }));

      setGames(gamesWithCounts);
    } catch (error) {
      console.error("Erro ao buscar jogos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
    const channel = supabase
      .channel('public:games')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => fetchGames())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const anime = (animeBase as any).default || animeBase;
    if (!loading && listRef.current && games.length > 0) {
        const cards = listRef.current.children;
        anime.set(cards, { opacity: 0, translateY: 20 });
        anime({
          targets: cards,
          opacity: [0, 1],
          translateY: [20, 0],
          delay: anime.stagger(100),
          duration: 600,
          easing: 'easeOutQuad'
        });
    }
  }, [loading, games]);

  const handleCreateGame = async () => {
    if (!profile) return;
    setCreating(true);

    try {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Aqui, em um cenário real com Nest.js, você chamaria api.post('/games')
        // const { data } = await api.post('/games', { host_id: profile.id, code, ... });
        
        const { data, error } = await supabase
            .from('games')
            .insert({
                host_id: profile.id,
                code: code,
                status: 'waiting',
                max_players: 10,
                current_round: 0
            })
            .select()
            .single();

        if (error) throw error;
        if (data) router.push(`/game/${data.id}`);
        
    } catch (error) {
        console.error("Erro ao criar sala:", error);
        alert("Não foi possível criar a sala.");
    } finally {
        setCreating(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch(status) {
        case 'waiting': return { text: 'Aguardando', color: 'text-neutral-400', border: 'border-neutral-600', dot: 'bg-transparent border border-neutral-400' };
        case 'in_progress': return { text: 'Em Progresso', color: 'text-white', border: 'border-white', dot: 'bg-white animate-pulse' };
        case 'finished': return { text: 'Finalizado', color: 'text-red-900', border: 'border-red-900', dot: 'bg-red-900' };
        default: return { text: 'Desconhecido', color: 'text-neutral-500', border: 'border-neutral-800', dot: 'bg-neutral-800' };
    }
  };

  if (authLoading) return <div className="min-h-screen bg-black" />;

  return (
    <div className="flex-grow w-full max-w-7xl mx-auto px-6 md:px-12 pb-12 pt-28 md:pt-36">
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-neutral-800 pb-6">
        <div>
            <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tighter mb-2">Lobby</h1>
            <p className="font-serif italic text-neutral-400">Escolha onde sua reputação vai morrer hoje.</p>
        </div>
        <div className="mt-6 md:mt-0">
             <Button onClick={handleCreateGame} disabled={creating || !profile}>
                {creating ? 'Criando...' : '+ Criar Sala'}
             </Button>
        </div>
      </div>

      <div ref={listRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
             <div className="col-span-full text-center py-20 text-neutral-500 font-serif animate-pulse">Carregando salas...</div>
        ) : games.length === 0 ? (
            <div className="col-span-full py-20 text-center border border-dashed border-neutral-800">
                <p className="font-serif italic text-neutral-500 text-xl">Nenhuma sala encontrada.</p>
            </div>
        ) : (
            games.map((game) => {
                const statusStyle = getStatusDisplay(game.status);
                // @ts-ignore
                const hostName = game.host?.username || 'Desconhecido';
                
                return (
                    <div key={game.id} className="group relative bg-black border border-neutral-800 hover:border-white transition-all duration-300 p-6 flex flex-col justify-between h-64 overflow-hidden">
                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none" />
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-2">
                                    <div className={`w-3 h-3 rounded-full ${statusStyle.dot}`} />
                                    <span className={`text-xs font-display font-bold tracking-widest uppercase ${statusStyle.color}`}>{statusStyle.text}</span>
                                </div>
                                <span className="font-serif text-neutral-500 italic text-sm">{game.code}</span>
                            </div>
                            <h3 className="text-2xl font-display font-bold uppercase leading-none mb-2 break-words">Sala de {hostName}</h3>
                            <p className="text-sm text-neutral-400 font-serif">Criado por <span className="text-white underline decoration-neutral-700 underline-offset-2">{hostName}</span></p>
                        </div>
                        <div className="mt-6 pt-6 border-t border-neutral-900 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Jogadores</span>
                                <span className="font-display font-bold text-xl">{game.player_count}<span className="text-neutral-600">/</span>{game.max_players}</span>
                            </div>
                            <button onClick={() => router.push(`/game/${game.id}`)} className="bg-transparent border border-white text-white px-6 py-2 font-display text-xs font-bold uppercase hover:bg-white hover:text-black transition-colors duration-300">Entrar</button>
                        </div>
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
}