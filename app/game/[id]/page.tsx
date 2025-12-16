'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import animeBase from 'animejs';
import PlayingCard from '../../../components/PlayingCard';
import CardCreatorModal from '../../../components/CardCreatorModal';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { GamePlayer, GameRoom as GameRoomType } from '../../../types';

const BLACK_CARD_TEXT = "Aguardando início da rodada...";

// Nest.js integration note: Em um cenário full-stack, os eventos abaixo (join, play card)
// seriam emitidos via socket.io-client conectado ao Gateway do Nest.js

export default function GameRoomPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { profile } = useAuth();
  
  const [roomData, setRoomData] = useState<GameRoomType | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [blackCardText, setBlackCardText] = useState(BLACK_CARD_TEXT);
  const [blackCardVisible, setBlackCardVisible] = useState(true);
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);

  const blackCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !profile) return;

    const joinRoom = async () => {
        try {
            const { data: game, error: gameError } = await supabase
                .from('games')
                .select('*')
                .eq('id', id)
                .single();

            if (gameError || !game) {
                alert("Sala não encontrada.");
                router.push('/hub');
                return;
            }
            setRoomData(game);

            const { data: existingPlayer } = await supabase
                .from('game_players')
                .select('*')
                .eq('game_id', id)
                .eq('player_id', profile.id)
                .single();

            if (!existingPlayer) {
                const { error: joinError } = await supabase
                    .from('game_players')
                    .insert({ game_id: id, player_id: profile.id, score: 0, is_czar: false });
                if (joinError) throw joinError;
            }

            fetchPlayers();

        } catch (error) {
            console.error("Erro ao entrar na sala:", error);
            router.push('/hub');
        } finally {
            setLoading(false);
        }
    };

    joinRoom();

    const channel = supabase
        .channel(`room:${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${id}` }, () => fetchPlayers())
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, profile, router]);

  const fetchPlayers = async () => {
      if (!id) return;
      const { data } = await supabase
        .from('game_players')
        .select(`*, profile:profiles(username, avatar_url)`)
        .eq('game_id', id);
      if (data) setPlayers(data);
  };

  if (loading) {
      return (
          <div className="h-screen w-full bg-black flex items-center justify-center text-white font-display uppercase tracking-widest animate-pulse">
              Conectando à sala...
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-900 overflow-hidden relative">
      <CardCreatorModal isOpen={isCreatorModalOpen} onClose={() => setIsCreatorModalOpen(false)} />
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150"></div>

      <div className="h-20 bg-black border-b border-neutral-800 flex items-center justify-between px-6 z-20">
        <div className="flex items-center space-x-4">
            <button onClick={() => router.push('/hub')} className="text-white hover:text-neutral-400 font-display text-sm">← SAIR</button>
            <div className="h-8 w-px bg-neutral-800" />
            <div>
                <h2 className="font-display font-bold text-lg leading-none">{roomData?.code ? `SALA: ${roomData.code}` : 'SALA'}</h2>
                <p className="text-xs text-neutral-500 font-serif italic">{players.length} Jogadores</p>
            </div>
        </div>
        
        <div className="flex items-center space-x-6">
            <button onClick={() => setIsCreatorModalOpen(true)} className="hidden md:flex items-center space-x-2 text-xs font-display font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors border border-neutral-800 hover:border-white px-3 py-1.5 rounded-sm">
                <span>+ Sugerir Carta</span>
            </button>
            <div className="flex -space-x-3">
                {players.map((p, i) => (
                    <div key={p.id} className="w-10 h-10 rounded-full border-2 border-black bg-neutral-800 flex items-center justify-center overflow-hidden hover:-translate-y-2 transition-transform cursor-help relative group" title={`${p.profile?.username}: ${p.score} Pontos`}>
                        {p.profile?.avatar_url ? (
                            <img src={p.profile.avatar_url} alt={p.profile.username} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs font-bold font-display text-white">{p.profile?.username?.substring(0,2).toUpperCase() || `P${i}`}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
      </div>

      <div className="flex-grow relative flex flex-col items-center justify-start pt-10 md:pt-16 p-4 pb-64 overflow-hidden">
        <div className="mb-8 pointer-events-none z-10">
            <span className={`inline-block px-4 py-1 rounded-full text-xs font-display tracking-widest uppercase transition-colors duration-500 bg-neutral-800 text-neutral-400`}>
                {roomData?.status === 'waiting' ? 'Aguardando mais jogadores...' : 'Jogo em andamento'}
            </span>
        </div>
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-16 w-full max-w-6xl justify-center">
            <div ref={blackCardRef} className={`relative z-10 transition-opacity duration-300 ${blackCardVisible ? 'opacity-100' : 'opacity-0'}`}>
                <PlayingCard variant="black" text={blackCardText} className="shadow-2xl shadow-black/80" />
            </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-64 md:h-80 flex justify-center items-end z-50 pointer-events-none pb-4">
            <div className="w-full h-24 bg-gradient-to-t from-black via-black/90 to-transparent flex items-end justify-center pb-6 pointer-events-auto">
                 <div className="flex items-center space-x-4 px-6 py-3 bg-neutral-900/80 border border-neutral-800 rounded-full backdrop-blur-md">
                    <p className="text-neutral-400 font-serif italic text-sm">O jogo começará em breve...</p>
                 </div>
            </div>
      </div>
      
      <div className="absolute bottom-4 right-4 z-[60] flex flex-col gap-2">
         <button onClick={() => setIsCreatorModalOpen(true)} className="md:hidden w-10 h-10 rounded-full bg-neutral-800 border border-neutral-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">+</button>
      </div>
    </div>
  );
}