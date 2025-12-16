import React, { useState, useEffect, useRef } from 'react';
import animeBase from 'animejs';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { GameRoom } from '../types';

const GameHub: React.FC = () => {
  const [games, setGames] = useState<GameRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [gameName, setGameName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [decks, setDecks] = useState<any[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { profile, user, loading: authLoading } = useAuth();
  const anime = (animeBase as any).default || animeBase;

  // Proteção: Redireciona para Setup se não tiver perfil completo
  useEffect(() => {
    if (!authLoading && user) {
        if (!profile || !profile.username) {
            navigate('/setup-profile');
        }
    } else if (!authLoading && !user) {
        navigate('/login');
    }
  }, [user, profile, authLoading, navigate]);

  const fetchGames = async () => {
    try {
      // Busca jogos e faz join com profiles para pegar o nome do host
      const { data, error } = await supabase
        .from('games')
        .select(`
            *,
            host:profiles!host_id(username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calcular contagem de jogadores
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        fetchGames();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, () => {
        fetchGames(); // Atualizar contagem de jogadores
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Buscar decks do usuário
  useEffect(() => {
    const fetchDecks = async () => {
      if (!profile) return;
      
      const { data } = await supabase
        .from('decks')
        .select(`
          *,
          deck_cards(count)
        `)
        .eq('created_by', profile.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setDecks(data);
        // Selecionar deck padrão automaticamente
        const defaultDeck = data.find(d => d.is_default);
        setSelectedDeckId(defaultDeck?.id || data[0].id);
      }
    };

    fetchDecks();
  }, [profile]);

  // Animação de entrada
  useEffect(() => {
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
    if (!profile || !gameName.trim() || !selectedDeckId) return;
    setCreating(true);

    try {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // 1. Criar o jogo
        const { data: gameData, error: gameError } = await supabase
            .from('games')
            .insert({
                host_id: profile.id,
                code: code,
                name: gameName.trim(),
                status: isPublic ? 'waiting' : 'private',
                max_players: maxPlayers,
                current_round: 0
            })
            .select()
            .single();

        if (gameError) throw gameError;

        // 2. Copiar cartas do deck selecionado para o jogo
        const { data: deckCards, error: cardsError } = await supabase
            .from('deck_cards')
            .select('*')
            .eq('deck_id', selectedDeckId)
            .eq('status', 'approved');

        if (cardsError) throw cardsError;

        if (deckCards && deckCards.length > 0) {
            const cardsToInsert = deckCards.map(card => ({
                game_id: gameData.id,
                type: card.type,
                text: card.text,
                status: 'approved',
                created_by: null, // Cartas do deck não têm autor individual
                created_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
                .from('cards')
                .insert(cardsToInsert);

            if (insertError) throw insertError;
        }

        // 3. Redirecionar para o jogo
        setShowCreateModal(false);
        setGameName('');
        setIsPublic(true);
        setMaxPlayers(8);
        navigate(`/game/${gameData.id}`);
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
        case 'finished': return { text: 'Finalizado', color: 'text-violet-700', border: 'border-violet-700', dot: 'bg-violet-700' };
        default: return { text: 'Desconhecido', color: 'text-neutral-500', border: 'border-neutral-800', dot: 'bg-neutral-800' };
    }
  };

  if (authLoading) return <div className="min-h-screen bg-black" />;

  return (
    <div className="flex-grow w-full max-w-7xl mx-auto px-6 md:px-12 pb-12 pt-28 md:pt-36">
      
      {/* Modal de Criação de Jogo */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-6 flex justify-between items-center z-10">
              <h2 className="text-2xl font-display font-bold uppercase">Criar Nova Sala</h2>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setGameName('');
                  setIsPublic(true);
                }}
                className="text-2xl hover:text-violet-700 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Nome do Jogo */}
              <div>
                <label className="block font-display text-sm font-bold uppercase tracking-wider mb-2 text-neutral-300">
                  Nome do Jogo
                </label>
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 px-4 py-3 text-white focus:outline-none focus:border-white font-serif"
                  placeholder="Ex: Caos Total"
                  maxLength={50}
                  autoFocus
                />
                <p className="text-xs text-neutral-500 mt-1 font-serif italic">
                  {gameName.length}/50 caracteres
                </p>
              </div>

              {/* Visibilidade */}
              <div>
                <label className="block font-display text-sm font-bold uppercase tracking-wider mb-3 text-neutral-300">
                  Visibilidade
                </label>
                <div className="space-y-3">
                  <button
                    onClick={() => setIsPublic(true)}
                    className={`w-full text-left p-4 border-2 transition-all ${
                      isPublic 
                        ? 'border-white bg-white/5' 
                        : 'border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-display font-bold text-white">Público</p>
                        <p className="text-sm text-neutral-400 font-serif">Qualquer pessoa pode entrar</p>
                      </div>
                      {isPublic && <span className="text-white text-xl">v</span>}
                    </div>
                  </button>

                  <button
                    onClick={() => setIsPublic(false)}
                    className={`w-full text-left p-4 border-2 transition-all ${
                      !isPublic 
                        ? 'border-white bg-white/5' 
                        : 'border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-display font-bold text-white">Privado</p>
                        <p className="text-sm text-neutral-400 font-serif">Apenas com código de acesso</p>
                      </div>
                      {!isPublic && <span className="text-white text-xl">v</span>}
                    </div>
                  </button>
                </div>
              </div>

              {/* Número de Jogadores */}
              <div>
                <label className="block font-display text-sm font-bold uppercase tracking-wider mb-3 text-neutral-300">
                  Número de Jogadores
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="flex-1 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <div className="w-20 text-center">
                    <span className="text-2xl font-display font-bold text-white">{maxPlayers}</span>
                    <span className="block text-xs text-neutral-500 font-serif">jogadores</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-neutral-600 mt-2 font-serif">
                  <span>Mínimo: 3</span>
                  <span>Máximo: 15</span>
                </div>
              </div>

              {/* Seleção de Deck */}
              <div>
                <label className="block font-display text-sm font-bold uppercase tracking-wider mb-3 text-neutral-300">
                  Deck de Cartas
                </label>
                {decks.length === 0 ? (
                  <div className="bg-neutral-800 border border-neutral-600 p-4 text-sm text-neutral-300 font-serif">
                    Você precisa criar um deck antes de criar um jogo.
                    <button
                      onClick={() => navigate('/decks')}
                      className="block mt-2 text-white underline hover:no-underline"
                    >
                      Criar meu primeiro deck →
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 px-4 py-3 text-white focus:outline-none focus:border-white font-serif"
                  >
                    {decks.map(deck => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name} {deck.is_default ? '(Padrão)' : ''} ({deck.deck_cards?.[0]?.count || 0} cartas)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setGameName('');
                    setIsPublic(true);
                    setMaxPlayers(8);
                  }}
                  className="flex-1 px-4 py-3 border border-neutral-700 text-neutral-400 hover:text-white hover:border-white transition-colors font-display font-bold uppercase"
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateGame}
                  disabled={creating || !gameName.trim() || decks.length === 0}
                  className="flex-1 px-4 py-3 bg-white text-black font-display font-bold uppercase hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Criando...' : 'Criar Sala'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-neutral-800 pb-6">
        <div>
            <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tighter mb-2">
                Lobby
            </h1>
            <p className="font-serif italic text-neutral-400">
                Escolha onde sua reputação vai morrer hoje.
            </p>
        </div>
        <div className="mt-6 md:mt-0">
             <Button onClick={() => setShowCreateModal(true)} disabled={!profile}>
                + Criar Sala
             </Button>
        </div>
      </div>

      {/* Game Grid */}
      <div ref={listRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
             <div className="col-span-full text-center py-20 text-neutral-500 font-serif animate-pulse">
                Carregando salas do abismo...
             </div>
        ) : games.length === 0 ? (
            <div className="col-span-full py-20 text-center border border-dashed border-neutral-800">
                <p className="font-serif italic text-neutral-500 text-xl">
                    Nenhuma sala encontrada. Seja o primeiro a iniciar o caos.
                </p>
            </div>
        ) : (
            games.map((game) => {
                const statusStyle = getStatusDisplay(game.status);
                // @ts-ignore
                const hostName = game.host?.username || 'Desconhecido';
                
                return (
                    <div 
                        key={game.id} 
                        className="group relative bg-black border border-neutral-800 hover:border-white transition-all duration-300 p-6 flex flex-col justify-between h-64 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none" />

                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-2">
                                    <div className={`w-3 h-3 rounded-full ${statusStyle.dot}`} />
                                    <span className={`text-xs font-display font-bold tracking-widest uppercase ${statusStyle.color}`}>
                                        {statusStyle.text}
                                    </span>
                                </div>
                                <span className="font-serif text-neutral-500 italic text-sm">
                                    {game.code}
                                </span>
                            </div>

                            <h3 className="text-2xl font-display font-bold uppercase leading-none mb-2 break-words">
                                {game.name || `Sala de ${hostName}`}
                            </h3>
                            
                            <p className="text-sm text-neutral-400 font-serif">
                                Criado por <span className="text-white underline decoration-neutral-700 underline-offset-2">{hostName}</span>
                            </p>
                        </div>

                        <div className="mt-6 pt-6 border-t border-neutral-900 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Jogadores</span>
                                <span className="font-display font-bold text-xl">
                                    {game.player_count}<span className="text-neutral-600">/</span>{game.max_players}
                                </span>
                            </div>
                            
                            <button 
                                onClick={() => navigate(`/game/${game.id}`)}
                                className="bg-transparent border border-white text-white px-6 py-2 font-display text-xs font-bold uppercase hover:bg-white hover:text-black transition-colors duration-300"
                            >
                                Entrar
                            </button>
                        </div>
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
};

export default GameHub;