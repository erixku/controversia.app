import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import animeBase from 'animejs';
import PlayingCard from '../components/PlayingCard';
import Button from '../components/Button';
import CardCreatorModal from '../components/CardCreatorModal';
import AvatarImage from '../components/AvatarImage';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { GamePlayer, GameRoom as GameRoomType } from '../types';

const DEFAULT_BLACK_CARD_TEXT = 'Aguardando início da rodada...';

type RoundStatus = 'picking' | 'judging' | 'completed';

interface GameRound {
  id: string;
  round_number: number;
  status: RoundStatus;
  black_card_id: string;
  pick_count: number;
  czar_player_id: string;
  winner_submission_id: string | null;
  black_card?: { id: string; text: string; creator?: { username: string; avatar_url?: string | null } | null } | null;
}

interface HandCard {
  handId: string;
  cardId: string;
  text: string;
  authorName?: string | null;
  authorAvatar?: string | null;
}

interface PlayedCard {
  id: string;
  text: string;
  submissionId: string;
  submissionSeq: number;
  isRevealed: boolean;
  isWinner: boolean;
  authorName?: string | null;
  authorAvatar?: string | null;
  playerId?: string;
  playerName?: string;
}

const GameRoom: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const anime = (animeBase as any).default || animeBase;

  // Supabase Data States
  const [roomData, setRoomData] = useState<GameRoomType | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameplayError, setGameplayError] = useState<string | null>(null);

  // Gameplay States (Supabase-backed)
  const [round, setRound] = useState<GameRound | null>(null);
  const [hand, setHand] = useState<HandCard[]>([]);
  const [playedCards, setPlayedCards] = useState<PlayedCard[]>([]);
  const [isCzar, setIsCzar] = useState(false); 
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [blackCardText, setBlackCardText] = useState(DEFAULT_BLACK_CARD_TEXT);
  const [blackCardVisible, setBlackCardVisible] = useState(true);
  const [mySubmissionId, setMySubmissionId] = useState<string | null>(null);
  const [mySubmittedCount, setMySubmittedCount] = useState(0);
  const [pileUi, setPileUi] = useState<Record<string, { frontIndex: number; isPeek: boolean }>>({});
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [gameCards, setGameCards] = useState<any[]>([]);
  const [pendingCards, setPendingCards] = useState<any[]>([]);
  const [gameName, setGameName] = useState('');
  const [decks, setDecks] = useState<any[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [addingDeck, setAddingDeck] = useState(false);
  const [clearingCards, setClearingCards] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

  // Refs
  const handRef = useRef<HTMLDivElement>(null);
  const blackCardRef = useRef<HTMLDivElement>(null);
  const playedCardsRef = useRef<HTMLDivElement>(null);
  const autoNextRoundTimerRef = useRef<number | null>(null);
  const isLeavingRef = useRef(false);

  const setGameplayErrorFromSupabase = (error: any) => {
    const message = String(error?.message || error?.details || error || '');
    const code = String(error?.code || '');

    // Missing tables / RPCs / schema not applied
    const looksLikeMissingDb =
      code === '42P01' ||
      code === '42883' ||
      /does not exist/i.test(message) ||
      /Could not find the (table|function)/i.test(message) ||
      /schema cache/i.test(message);

    if (looksLikeMissingDb) {
      setGameplayError('Gameplay do Supabase não está configurado (aplique o SQL e habilite Realtime).');
      return;
    }

    // Permission/RLS errors
    const looksLikeRls =
      code === '42501' ||
      /permission denied/i.test(message) ||
      /violates row-level security/i.test(message);

    if (looksLikeRls) {
      setGameplayError('Sem permissão para acessar o gameplay (verifique RLS/policies no Supabase).');
      return;
    }
  };

  // 1. JOIN ROOM LOGIC
  useEffect(() => {
    if (!id || !profile) return;

    const joinRoom = async () => {
        try {
            // A. Verificar se a sala existe
            const { data: game, error: gameError } = await supabase
                .from('games')
                .select('*')
                .eq('id', id)
                .single();

            if (gameError || !game) {
                alert("Sala não encontrada.");
                navigate('/hub');
                return;
            }
            
            // Verificar se jogo não está finalizado
            if (game.status === 'finished') {
                alert('Este jogo já foi finalizado.');
                navigate('/hub');
                return;
            }
            
            setRoomData(game);
            setGameName(game.name || '');

            // B. Verificar se já estou na sala
            const { data: existingPlayer, error: playerCheckError } = await supabase
                .from('game_players')
                .select('*')
                .eq('game_id', id)
                .eq('player_id', profile.id)
                .maybeSingle();

            if (!existingPlayer && !playerCheckError) {
                // Verificar lotação antes de entrar
                const { count, error: countError } = await supabase
                    .from('game_players')
                    .select('*', { count: 'exact', head: true })
                    .eq('game_id', id);
                
                if (countError) throw countError;
                
                if (count && count >= game.max_players) {
                    alert('Sala lotada! Não é possível entrar.');
                    navigate('/hub');
                    return;
                }

                // Entrar na sala apenas se não estiver
                const { error: joinError } = await supabase
                    .from('game_players')
                    .insert({
                        game_id: id,
                        player_id: profile.id,
                        score: 0,
                        is_czar: false
                    });
                
                if (joinError && joinError.code !== '23505') {
                    // 23505 = unique violation (já está na sala)
                    console.error('Erro ao entrar na sala:', joinError);
                    throw joinError;
                }
            }

            // C. Buscar lista de jogadores inicial
            fetchPlayers();

        } catch (error) {
            console.error("Erro ao entrar na sala:", error);
            alert("Não foi possível entrar na sala. Verifique sua conexão e tente novamente.");
            navigate('/hub');
        } finally {
            setLoading(false);
        }
    };

    joinRoom();

    // D. Realtime Subscription para Players e mudanças no jogo
    const channel = supabase
        .channel(`room:${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${id}` }, () => {
            fetchPlayers();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, (payload) => {
            setRoomData(prev => prev ? { ...prev, ...payload.new } : null);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rounds', filter: `game_id=eq.${id}` }, () => {
        fetchRoundAndTable();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_submissions', filter: `game_id=eq.${id}` }, () => {
        fetchRoundAndTable();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_submission_cards', filter: `game_id=eq.${id}` }, () => {
        fetchRoundAndTable();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_hands', filter: `game_id=eq.${id}` }, () => {
        fetchHand();
      })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `game_id=eq.${id}` }, () => {
            fetchGameCards();
            fetchPendingCards();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
        
        // Remove player from room on unmount
        if (id && profile && !isLeavingRef.current) {
            supabase.from('game_players').delete().match({ game_id: id, player_id: profile.id }).then();
        }
    };
  }, [id, profile]);

  // Handle browser tab close / refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
        if (id && profile) {
            // Best effort to remove player
            supabase.from('game_players').delete().match({ game_id: id, player_id: profile.id }).then();
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [id, profile]);

  const handleLeaveRoom = async () => {
      if (!id || !profile) return;
      isLeavingRef.current = true;
      
      try {
          await supabase.from('game_players').delete().match({ game_id: id, player_id: profile.id });
      } catch (error) {
          console.error("Erro ao sair da sala:", error);
      } finally {
          navigate('/hub');
      }
  };

  const fetchPlayers = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('game_players')
          .select(`
              id,
              player_id,
              score,
              is_czar,
              profiles!player_id(
                id,
                username,
                avatar_url
              )
          `)
          .eq('game_id', id);
        
        if (error) {
          console.error('Erro ao buscar jogadores:', error);
          return;
        }

        // Reformata os dados para o formato esperado
        const formattedPlayers = data?.map(p => ({
          id: p.id,
          player_id: p.player_id,
          score: p.score,
          is_czar: p.is_czar,
          profile: p.profiles
        })) || [];
        
        setPlayers(formattedPlayers);

        // Verifica se o jogador atual é o czar
        if (profile) {
          const currentPlayer = data?.find(p => p.player_id === profile.id);
          setIsCzar(currentPlayer?.is_czar || false);
        }
      } catch (err) {
        console.error('Erro ao processar jogadores:', err);
      }
  };

  // --- ADMIN FUNCTIONS ---
  const isOwner = roomData?.host_id === profile?.id;

  // --- GAMEPLAY FUNCTIONS ---
  const pickCount = round?.pick_count ?? 1;

  const isMyCard = (card: PlayedCard) => card.submissionId === mySubmissionId;
  const myHasPlayedThisRound = mySubmissionId ? playedCards.some((c) => c.submissionId === mySubmissionId) : false;

  const gameState: 'picking' | 'waiting' | 'judging' = (() => {
    if (!round) return 'waiting';
    if (round.status === 'judging') return 'judging';
    if (round.status === 'completed') return 'waiting';
    // picking
    if (isCzar) return 'waiting';
    return mySubmittedCount >= pickCount ? 'waiting' : 'picking';
  })();

  useEffect(() => {
    // Ao iniciar/voltar para uma fase de escolha (ou reset), reseta estado de envio
    if (!round || round.status === 'picking') {
      setSelectedCardIndex(null);
    }
  }, [round?.id, round?.status]);

  useEffect(() => {
    if (!id || !profile) return;
    fetchRoundAndTable();
    fetchHand();
  }, [id, profile?.id]);

  useEffect(() => {
    if (!id || !isOwner) return;
    if (!roomData) return;
    if (players.length < 3) return;
    if (round) return;

    // Auto-start first round once we have minimum players.
    supabase.rpc('start_round', { p_game_id: id }).catch((e) => {
      console.error('Erro ao iniciar rodada:', e);
    });
  }, [id, isOwner, roomData?.id, players.length, round?.id]);

  useEffect(() => {
    if (!id || !isOwner) return;
    if (!round || round.status !== 'completed') return;

    if (autoNextRoundTimerRef.current) window.clearTimeout(autoNextRoundTimerRef.current);
    autoNextRoundTimerRef.current = window.setTimeout(() => {
      supabase.rpc('start_round', { p_game_id: id }).catch((e) => {
        console.error('Erro ao iniciar próxima rodada:', e);
      });
    }, 3000);

    return () => {
      if (autoNextRoundTimerRef.current) window.clearTimeout(autoNextRoundTimerRef.current);
    };
  }, [id, isOwner, round?.id, round?.status]);

  const ensurePileUi = (submissionId: string) => {
    setPileUi(prev => (prev[submissionId] ? prev : { ...prev, [submissionId]: { frontIndex: 0, isPeek: false } }));
  };

  const setPilePeek = (submissionId: string, isPeek: boolean) => {
    setPileUi(prev => ({
      ...prev,
      [submissionId]: {
        frontIndex: prev[submissionId]?.frontIndex ?? 0,
        isPeek
      }
    }));
  };

  const cyclePile = (submissionId: string, pileSize: number) => {
    if (pileSize <= 1) return;
    setPileUi(prev => {
      const current = prev[submissionId] ?? { frontIndex: 0, isPeek: true };
      return {
        ...prev,
        [submissionId]: {
          isPeek: true,
          frontIndex: (current.frontIndex + 1) % pileSize
        }
      };
    });
  };

  const fetchRoundAndTable = async () => {
    if (!id) return;
    try {
      const { data: roundRow, error: roundError } = await supabase
        .from('game_rounds')
        .select(`
          id,
          round_number,
          status,
          black_card_id,
          pick_count,
          czar_player_id,
          winner_submission_id,
          black_card:cards!black_card_id(
            id,
            text,
            creator:profiles!created_by(username, avatar_url)
          )
        `)
        .eq('game_id', id)
        .order('round_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roundError) {
        console.error('Erro ao buscar rodada:', roundError);
        setGameplayErrorFromSupabase(roundError);
        return;
      }

      setRound(roundRow as any);
      setBlackCardText((roundRow as any)?.black_card?.text || DEFAULT_BLACK_CARD_TEXT);
      setGameplayError(null);

      if (roundRow) {
        await Promise.all([fetchMySubmission(roundRow.id), fetchPlayedCards(roundRow.id, (roundRow as any).winner_submission_id, (roundRow as any).status)]);
      } else {
        setMySubmissionId(null);
        setMySubmittedCount(0);
        setPlayedCards([]);
      }
    } catch (e) {
      console.error('Erro ao buscar estado do jogo:', e);
      setGameplayErrorFromSupabase(e);
    }
  };

  const fetchMySubmission = async (roundId: string) => {
    if (!id || !profile) return;
    const { data: submissionRow, error: submissionError } = await supabase
      .from('game_submissions')
      .select('id')
      .eq('game_id', id)
      .eq('round_id', roundId)
      .eq('player_id', profile.id)
      .maybeSingle();

    if (submissionError) {
      console.error('Erro ao buscar minha submission:', submissionError);
      setGameplayErrorFromSupabase(submissionError);
      return;
    }

    const submissionId = submissionRow?.id ?? null;
    setMySubmissionId(submissionId);

    if (!submissionId) {
      setMySubmittedCount(0);
      return;
    }

    const { count } = await supabase
      .from('game_submission_cards')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', id)
      .eq('round_id', roundId)
      .eq('submission_id', submissionId);

    setMySubmittedCount(count ?? 0);
  };

  const fetchPlayedCards = async (roundId: string, winnerSubmissionId: string | null, status: RoundStatus) => {
    if (!id) return;

    const { data: cardRows, error } = await supabase
      .from('game_submission_cards')
      .select(`
        id,
        submission_id,
        seq,
        card:cards(
          id,
          text,
          created_by,
          creator:profiles!created_by(username, avatar_url)
        )
      `)
      .eq('game_id', id)
      .eq('round_id', roundId)
      .order('submission_id', { ascending: true })
      .order('seq', { ascending: true });

    if (error) {
      console.error('Erro ao buscar cartas jogadas:', error);
      setGameplayErrorFromSupabase(error);
      return;
    }

    const base: PlayedCard[] = (cardRows || []).map((r: any) => ({
      id: r.id,
      submissionId: r.submission_id,
      submissionSeq: r.seq,
      text: r.card?.text ?? '',
      isRevealed: status === 'completed',
      isWinner: !!winnerSubmissionId && r.submission_id === winnerSubmissionId,
      authorName: r.card?.creator?.username ?? null,
      authorAvatar: r.card?.creator?.avatar_url ?? null
    }));

    // Only after completion do we fetch identities (and only then RLS allows it).
    if (status === 'completed') {
      const { data: submissions, error: subErr } = await supabase
        .from('game_submissions')
        .select(`id, player_id, profiles!player_id(username)`)
        .eq('game_id', id)
        .eq('round_id', roundId);

      if (subErr) {
        setGameplayErrorFromSupabase(subErr);
      }
      if (!subErr && submissions) {
        const bySubmission = new Map<string, { playerId: string; playerName?: string }>();
        for (const s of submissions as any[]) {
          bySubmission.set(s.id, { playerId: s.player_id, playerName: s.profiles?.username });
        }
        for (const c of base) {
          const meta = bySubmission.get(c.submissionId);
          if (meta) {
            c.playerId = meta.playerId;
            c.playerName = meta.playerName;
          }
        }
      }
    }

    setPlayedCards(base);
  };

  const fetchHand = async () => {
    if (!id || !profile) return;

    const { data, error } = await supabase
      .from('game_hands')
      .select(`
        id,
        card_id,
        card:cards(
          id,
          text,
          created_by,
          creator:profiles!created_by(username, avatar_url)
        )
      `)
      .eq('game_id', id)
      .eq('player_id', profile.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar mão:', error);
      setGameplayErrorFromSupabase(error);
      return;
    }

    const mapped: HandCard[] = (data || []).map((r: any) => ({
      handId: r.id,
      cardId: r.card_id,
      text: r.card?.text ?? '',
      authorName: r.card?.creator?.username ?? null,
      authorAvatar: r.card?.creator?.avatar_url ?? null
    }));
    setHand(mapped);
    setGameplayError(null);
  };

  const handlePlayCard = async (index: number) => {
    if (isCzar) {
      // Czar não pode jogar cartas
      return;
    }

    if (!id || !round) return;

    if (mySubmittedCount >= pickCount) {
      // Já enviou o máximo de cartas permitido pela carta preta
      return;
    }

    if (selectedCardIndex === index) {
      try {
        const chosen = hand[index];
        if (!chosen) return;

        const { data: submissionId, error } = await supabase.rpc('submit_card', {
          p_game_id: id,
          p_round_id: round.id,
          p_card_id: chosen.cardId
        });

        if (error) {
          console.error('Erro ao enviar carta:', error);
          setGameplayErrorFromSupabase(error);
          return;
        }

        if (submissionId && typeof submissionId === 'string') {
          setMySubmissionId(submissionId);
          ensurePileUi(submissionId);
        }

        // Optimistic UI: remove from local hand immediately.
        setHand(prev => prev.filter((_, i) => i !== index));
        setSelectedCardIndex(null);
        setMySubmittedCount((c) => c + 1);
      } catch (e) {
        console.error('Erro ao enviar carta:', e);
        setGameplayErrorFromSupabase(e);
      }
    } else {
      // Seleciona a carta
      setSelectedCardIndex(index);
    }
  };

  const handleSelectWinner = async (submissionId: string) => {
    if (!id || !round) return;
    if (!isCzar || round.status !== 'judging') {
      return;
    }

    try {
      const { error } = await supabase.rpc('choose_winner', {
        p_round_id: round.id,
        p_submission_id: submissionId
      });
      if (error) {
        console.error('Erro ao escolher vencedor:', error);
        setGameplayErrorFromSupabase(error);
      }
    } catch (e) {
      console.error('Erro ao escolher vencedor:', e);
      setGameplayErrorFromSupabase(e);
    }
  };

  const fetchGameCards = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('cards')
      .select(`
        *,
        creator:profiles!created_by(id, username, avatar_url)
      `)
      .eq('game_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    
    if (data) setGameCards(data);
  };

  const fetchPendingCards = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('cards')
        .select(`
          *,
          creator:profiles!created_by(id, username, avatar_url)
        `)
        .eq('game_id', id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingCards(data || []);
    } catch (error) {
      console.error('Erro ao buscar cartas pendentes:', error);
    }
  };

  const handleApproveCard = async (cardId: string) => {
    const card = pendingCards.find(c => c.id === cardId);

    try {
      const { error } = await supabase
        .from('cards')
        .update({ status: 'approved' })
        .eq('id', cardId);

      if (error) throw error;

      // Add to deck if selected
      if (selectedDeckId && card) {
          const { error: deckError } = await supabase
            .from('deck_cards')
            .insert({
                deck_id: selectedDeckId,
                text: card.text,
                type: card.type,
            status: 'approved',
            created_by: card.created_by ?? null
            });
            
          if (deckError) {
             console.error("Erro ao salvar no deck:", deckError);
             setAdminSuccess('Carta aprovada (erro ao salvar no deck)');
          } else {
             setAdminSuccess('Carta aprovada e salva no deck!');
          }
      } else {
          setAdminSuccess('Carta aprovada!');
      }

      fetchPendingCards();
      fetchGameCards();
      setTimeout(() => setAdminSuccess(null), 3000);
    } catch (error: any) {
      setAdminError(error.message);
    }
  };

  const handleRejectCard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from('cards')
        .update({ status: 'rejected' })
        .eq('id', cardId);

      if (error) throw error;
      setAdminSuccess('Carta rejeitada!');
      fetchPendingCards();
      setTimeout(() => setAdminSuccess(null), 3000);
    } catch (error: any) {
      setAdminError(error.message);
    }
  };

  const handleUpdateGameName = async () => {
    if (!id || !isOwner) return;
    setAdminError(null);
    setAdminSuccess(null);

    try {
      const { error } = await supabase
        .from('games')
        .update({ name: gameName.trim() })
        .eq('id', id);

      if (error) throw error;
      
      setRoomData(prev => prev ? { ...prev, name: gameName.trim() } : null);
      setAdminSuccess('Nome atualizado com sucesso!');
      setTimeout(() => setAdminSuccess(null), 3000);
    } catch (error: any) {
      setAdminError(error.message || 'Erro ao atualizar nome');
    }
  };

  const handlePublishGame = async () => {
    if (!id || !isOwner) return;
    setPublishLoading(true);
    setAdminError(null);
    setAdminSuccess(null);

    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'published' })
        .eq('id', id);

      if (error) throw error;
      
      setRoomData(prev => prev ? { ...prev, status: 'published' } : null);
      setAdminSuccess('Jogo publicado com sucesso!');
      setTimeout(() => setAdminSuccess(null), 3000);
    } catch (error: any) {
      setAdminError(error.message || 'Erro ao publicar jogo');
    } finally {
      setPublishLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!isOwner || !id) return;
    if (players.length < 3) {
        alert("É necessário ter pelo menos 3 jogadores para iniciar.");
        return;
    }

    try {
        const { error } = await supabase.rpc('start_round', { p_game_id: id });

        if (error) throw error;
    } catch (error: any) {
        console.error("Erro ao iniciar jogo:", error);
        alert(error.message || "Erro ao iniciar jogo.");
    }
  };

  const handleEndGame = async () => {
    if (!isOwner || !id) return;
    if (!confirm("Tem certeza que deseja terminar o jogo?")) return;

    try {
        const { error } = await supabase
            .from('games')
            .update({ status: 'finished' })
            .eq('id', id);

        if (error) throw error;
        navigate('/hub');
    } catch (error: any) {
        console.error("Erro ao terminar jogo:", error);
        alert(error.message || "Erro ao terminar jogo.");
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!isOwner) return;
    if (!confirm('Tem certeza que deseja remover esta carta?')) return;

    try {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;
      
      setGameCards(prev => prev.filter(c => c.id !== cardId));
      setAdminSuccess('Carta removida com sucesso!');
      setTimeout(() => setAdminSuccess(null), 3000);
    } catch (error: any) {
      setAdminError(error.message || 'Erro ao remover carta');
    }
  };

  const handleDeleteGame = async () => {
    if (!isOwner || !id) return;

    setDeleteLoading(true);
    setAdminError(null);
    setShowDeleteConfirm(false);

    try {
      // Deletar jogo (cascade vai deletar players e cards associados)
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Redirecionar para hub
      navigate('/hub');
    } catch (error: any) {
      setAdminError(error.message || 'Erro ao apagar jogo');
      setDeleteLoading(false);
    }
  };

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
      if (!selectedDeckId) {
          const defaultDeck = data.find(d => d.is_default);
          setSelectedDeckId(defaultDeck?.id || data[0].id);
      }
    }
  };

  const handleAddDeck = async () => {
    if (!selectedDeckId || !id) return;
    setAddingDeck(true);
    setAdminError(null);

    try {
        // Buscar cartas do deck
        const { data: deckCards, error: cardsError } = await supabase
            .from('deck_cards')
            .select('*')
            .eq('deck_id', selectedDeckId)
            .eq('status', 'approved');

        if (cardsError) throw cardsError;

        if (deckCards && deckCards.length > 0) {
            const cardsToInsert = deckCards.map(card => ({
                game_id: id,
                type: card.type,
                text: card.text,
                status: 'approved',
                created_by: null,
                created_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
                .from('cards')
                .insert(cardsToInsert);

            if (insertError) throw insertError;
            
            setAdminSuccess(`${deckCards.length} cartas adicionadas com sucesso!`);
            setTimeout(() => setAdminSuccess(null), 3000);
            fetchGameCards();
        } else {
            setAdminError('Este deck não possui cartas aprovadas.');
        }
    } catch (error: any) {
        setAdminError(error.message || 'Erro ao adicionar deck');
    } finally {
        setAddingDeck(false);
    }
  };

  const handleClearCards = async () => {
    if (!id) return;
    if (!confirm('Tem certeza que deseja apagar TODAS as cartas do jogo? Esta ação não pode ser desfeita.')) return;
    
    setClearingCards(true);
    setAdminError(null);

    try {
        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('game_id', id);

        if (error) throw error;

        setAdminSuccess('Todas as cartas foram removidas.');
        setTimeout(() => setAdminSuccess(null), 3000);
        setGameCards([]);
    } catch (error: any) {
        setAdminError(error.message || 'Erro ao limpar cartas');
    } finally {
        setClearingCards(false);
    }
  };

  useEffect(() => {
    if (isAdminModalOpen && isOwner) {
      fetchGameCards();
      fetchPendingCards();
      fetchDecks();
    }
  }, [isAdminModalOpen, isOwner]);

  // --- RENDER HELPERS ---

  if (loading) {
      return (
          <div className="h-screen w-full bg-black flex items-center justify-center text-white font-display uppercase tracking-widest animate-pulse">
              Conectando à sala...
          </div>
      );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-900 overflow-visible relative">
      
      <CardCreatorModal isOpen={isCreatorModalOpen} onClose={() => setIsCreatorModalOpen(false)} gameId={id || ''} />

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[160] flex items-center justify-center p-4">
          <div className="bg-neutral-900 border-2 border-violet-700 max-w-md w-full">
            <div className="bg-violet-700/20 border-b border-violet-700 p-6">
              <h2 className="text-2xl font-display font-bold uppercase text-violet-700 flex items-center gap-3">
                Confirmar Exclusão
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="font-serif text-white text-lg leading-relaxed">
                Tem certeza que deseja <span className="font-bold text-violet-700">apagar este jogo permanentemente</span>?
              </p>
              
              <div className="bg-violet-700/10 border border-violet-700/50 p-4">
                <p className="font-serif text-sm text-neutral-300 leading-relaxed">
                  Esta ação é <span className="font-bold text-violet-400">irreversível</span>. 
                  Todos os dados serão perdidos:
                </p>
                <ul className="mt-3 space-y-1 text-sm text-neutral-400 font-serif">
                  <li>• Todas as cartas criadas</li>
                  <li>• Lista de jogadores</li>
                  <li>• Histórico de partidas</li>
                  <li>• Configurações do jogo</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-3 border-2 border-neutral-700 text-white hover:border-white hover:bg-white/5 transition-colors font-display font-bold uppercase disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteGame}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-3 bg-violet-700 border-2 border-violet-700 text-white font-display font-bold uppercase hover:bg-violet-800 hover:border-violet-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? 'Apagando...' : 'Apagar Jogo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN MODAL */}
      {isAdminModalOpen && isOwner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold uppercase">Configurações do Jogo</h2>
              <button onClick={() => setIsAdminModalOpen(false)} className="text-2xl hover:text-violet-700 transition-colors">
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Mensagens */}
              {adminError && (
                <div className="p-3 border border-violet-700 bg-violet-700/10 text-violet-700 text-sm text-center">
                  {adminError}
                </div>
              )}
              {adminSuccess && (
                <div className="p-3 border border-neutral-600 bg-neutral-800 text-white text-sm text-center">
                  {adminSuccess}
                </div>
              )}

              {/* Cartas Pendentes de Aprovação */}
              <div>
                <h3 className="font-display font-bold text-lg mb-3 uppercase text-neutral-300">
                  Cartas Pendentes de Aprovação ({pendingCards.length})
                </h3>
                
                {pendingCards.length === 0 ? (
                  <p className="text-neutral-500 font-serif italic text-sm py-4">
                    Nenhuma carta pendente de aprovação.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {pendingCards.map((card) => (
                      <div
                        key={card.id}
                        className="border border-neutral-700 bg-neutral-800 p-3 flex items-start gap-3"
                      >
                        <div className="flex-grow">
                          <div className="flex items-center gap-2 mb-2">
                            {card.creator?.avatar_url && (
                              <AvatarImage
                                pathOrUrl={card.creator.avatar_url}
                                alt={card.creator.username}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            )}
                            <span className="font-display font-bold text-sm text-white">
                              {card.creator?.username || 'Anônimo'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 ${
                              card.type === 'black' 
                                ? 'bg-black text-white border border-neutral-700' 
                                : 'bg-white text-black border border-neutral-300'
                            }`}>
                              {card.type === 'black' ? 'PRETA' : 'BRANCA'}
                            </span>
                          </div>
                          <p className="font-serif text-sm text-neutral-300">"{card.text}"</p>
                          <p className="text-xs text-neutral-600 mt-1">
                            {new Date(card.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveCard(card.id)}
                            className="px-3 py-1 bg-neutral-700 text-white border border-neutral-600 hover:bg-neutral-600 text-xs font-display font-bold uppercase"
                          >
                            Aprovar
                          </button>
                          <button
                            onClick={() => handleRejectCard(card.id)}
                            className="px-3 py-1 bg-neutral-700 text-white border border-neutral-600 hover:border-violet-700 hover:text-violet-700 text-xs font-display font-bold uppercase"
                          >
                            Rejeitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informações do Jogo */}
              <div>
                <h3 className="font-display font-bold text-lg mb-3 uppercase">Informações</h3>
                <div className="bg-neutral-800 border border-neutral-700 p-4">
                  <p className="text-sm text-neutral-400 mb-2">
                    <span className="font-bold text-white">Código da Sala:</span> {roomData?.code}
                  </p>
                  <p className="text-sm text-neutral-400">
                    <span className="font-bold text-white">Jogadores:</span> {players.length}
                  </p>
                </div>
              </div>

              {/* Publicar Jogo */}
              <div className="border-t border-neutral-800 pt-6">
                <h3 className="font-display font-bold text-lg mb-3 uppercase">Status do Jogo</h3>
                <p className="text-sm text-neutral-400 mb-4 font-serif">
                  Status atual: <span className="text-white font-bold">{roomData?.status || 'waiting'}</span>
                </p>
                {roomData?.status !== 'published' && (
                  <button
                    onClick={handlePublishGame}
                    disabled={publishLoading}
                    className="px-6 py-3 bg-white text-black font-display font-bold uppercase hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {publishLoading ? 'Publicando...' : 'Publicar Jogo'}
                  </button>
                )}
              </div>

              {/* Cartas do Jogo */}
              <div className="border-t border-neutral-800 pt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <h3 className="font-display font-bold text-lg uppercase">
                    Cartas do Jogo ({gameCards.length})
                    </h3>
                    
                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                        {decks.length > 0 && (
                            <div className="flex gap-2">
                                <select
                                    value={selectedDeckId}
                                    onChange={(e) => setSelectedDeckId(e.target.value)}
                                    className="bg-neutral-800 border border-neutral-700 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-white font-serif max-w-[150px]"
                                >
                                    {decks.map(deck => (
                                        <option key={deck.id} value={deck.id}>
                                            {deck.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleAddDeck}
                                    disabled={addingDeck}
                                    className="px-3 py-1.5 bg-white text-black text-xs font-display font-bold uppercase hover:bg-neutral-200 disabled:opacity-50 whitespace-nowrap"
                                >
                                    {addingDeck ? '...' : '+ Deck'}
                                </button>
                            </div>
                        )}
                        
                        {gameCards.length > 0 && (
                            <button
                                onClick={handleClearCards}
                                disabled={clearingCards}
                            className="px-3 py-1.5 border border-violet-700/50 text-violet-700 text-xs font-display font-bold uppercase hover:bg-violet-700/10 disabled:opacity-50 whitespace-nowrap"
                            >
                                {clearingCards ? '...' : 'Limpar Tudo'}
                            </button>
                        )}
                    </div>
                </div>

                {gameCards.length === 0 ? (
                  <p className="text-neutral-500 font-serif italic text-center py-8">
                    Nenhuma carta cadastrada ainda.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {gameCards.map((card) => (
                      <div
                        key={card.id}
                        className={`flex items-center justify-between border p-4 transition-colors ${
                            card.type === 'white' 
                                ? 'bg-white border-neutral-300 text-black' 
                                : 'bg-black border-neutral-700 text-white'
                        }`}
                      >
                        <div className="flex-1">
                          <p className="font-display font-bold text-lg leading-tight">{card.text}</p>
                          {card.creator?.username && (
                            <div className="flex items-center gap-2 mt-2">
                              {card.creator?.avatar_url && (
                                <AvatarImage
                                  pathOrUrl={card.creator.avatar_url}
                                  alt={card.creator.username}
                                  className="w-5 h-5 rounded-full object-cover"
                                />
                              )}
                              <span className={`text-xs font-display font-bold uppercase tracking-wider ${card.type === 'white' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                                Sugerida por {card.creator.username}
                              </span>
                            </div>
                          )}
                          <p className={`text-xs mt-2 ${card.type === 'white' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            Tipo: {card.type === 'white' ? 'Branca' : 'Preta'} • 
                            Criado em {new Date(card.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          className={`ml-4 px-3 py-1 text-xs font-display font-bold uppercase border transition-colors ${
                              card.type === 'white'
                                ? 'border-neutral-300 text-neutral-500 hover:border-violet-700 hover:text-violet-700'
                                : 'border-neutral-700 text-neutral-500 hover:border-violet-700 hover:text-violet-700'
                          }`}
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Zona de Perigo */}
              <div className="border-t border-violet-700/30 pt-6">
                <h3 className="font-display font-bold text-lg mb-3 uppercase text-violet-700">Zona de Perigo</h3>
                <div className="bg-violet-700/10 border border-violet-700/30 p-4">
                  <p className="text-sm text-neutral-400 mb-4 font-serif">
                    Apagar o jogo é uma ação <span className="text-violet-700 font-bold">permanente e irreversível</span>. 
                    Todas as cartas, jogadores e dados associados serão perdidos.
                  </p>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleteLoading}
                    className="px-6 py-3 bg-violet-700 text-white font-display font-bold uppercase hover:bg-violet-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apagar Jogo Permanentemente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BACKGROUND NOISE */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150"></div>

      {/* --- TOP BAR: INFO & OPPONENTS --- */}
        <div className="h-20 bg-black border-b border-neutral-800 flex items-center justify-between px-4 md:px-6 z-20">
        <div className="flex items-center space-x-3 md:space-x-4 min-w-0">
          <button
            onClick={handleLeaveRoom}
            className="text-white hover:text-neutral-400 font-display text-sm flex-shrink-0"
            aria-label="Sair da sala"
            title="Sair"
          >
            <span className="md:hidden inline-flex items-center justify-center w-9 h-9 border border-neutral-800 hover:border-white transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </span>
            <span className="hidden md:inline">← SAIR</span>
          </button>
            <div className="h-8 w-px bg-neutral-800" />
          <div className="min-w-0">
            <h2 className="font-display font-bold text-base md:text-lg leading-none truncate">
                    {roomData?.code ? `SALA: ${roomData.code}` : 'SALA'}
                </h2>
                <p className="text-xs text-neutral-500 font-serif italic">
                    {players.length} Jogadores
                </p>
            </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-6 flex-shrink-0">
            {isOwner && (
                <>
                    {roomData?.status === 'waiting' ? (
                        <button 
                            onClick={handleStartGame}
                            disabled={players.length < 3}
                            className={`flex items-center space-x-2 text-xs font-display font-bold uppercase tracking-widest transition-colors border px-3 py-1.5 rounded-sm ${
                                players.length < 3 
                                    ? 'text-neutral-600 border-neutral-800 cursor-not-allowed' 
                                    : 'text-black bg-white border-white hover:bg-neutral-200'
                            }`}
                            title={players.length < 3 ? "Mínimo de 3 jogadores" : "Iniciar o jogo"}
                            aria-label="Iniciar jogo"
                        >
                            <span className="md:hidden inline-flex items-center justify-center w-9 h-9 -my-1 -mx-1">
                              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </span>
                            <span className="hidden md:inline">Iniciar Jogo</span>
                        </button>
                    ) : roomData?.status === 'in_progress' ? (
                        <button 
                            onClick={handleEndGame}
                        className="flex items-center space-x-2 text-xs font-display font-bold uppercase tracking-widest text-violet-700 hover:text-violet-600 transition-colors border border-violet-700/30 hover:border-violet-700 px-3 py-1.5 rounded-sm"
                        aria-label="Terminar jogo"
                        >
                            <span className="md:hidden inline-flex items-center justify-center w-9 h-9 -my-1 -mx-1">
                              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                                <path d="M7 7h10v10H7z" />
                              </svg>
                            </span>
                            <span className="hidden md:inline">Terminar Jogo</span>
                        </button>
                    ) : null}

                    <button 
                        onClick={() => setIsAdminModalOpen(true)}
                        className="flex items-center space-x-2 text-xs font-display font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors border border-neutral-700 hover:border-white px-3 py-1.5 rounded-sm"
                        aria-label="Abrir configurações"
                    >
                        <span className="md:hidden inline-flex items-center justify-center w-9 h-9 -my-1 -mx-1">
                          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                            <path d="M19.4 15a7.8 7.8 0 0 0 .1-2l2-1.5-2-3.5-2.4.7a7.7 7.7 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.7 7.7 0 0 0-1.7 1L4.7 8l-2 3.5 2 1.5a7.8 7.8 0 0 0 .1 2l-2 1.5 2 3.5 2.4-.7a7.7 7.7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.7 7.7 0 0 0 1.7-1l2.4.7 2-3.5-2-1.5z" />
                          </svg>
                        </span>
                        <span className="hidden md:inline">Configurações</span>
                    </button>
                </>
            )}
            
            <button 
                onClick={() => setIsCreatorModalOpen(true)}
                className="hidden md:flex items-center space-x-2 text-xs font-display font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors border border-neutral-800 hover:border-white px-3 py-1.5 rounded-sm"
            >
                <span>+ Sugerir Carta</span>
            </button>

            {/* Real Opponents Avatars */}
            <div className="flex -space-x-2 md:-space-x-3">
                {players.map((p, i) => (
                    <div 
                        key={p.id} 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-black bg-neutral-800 flex items-center justify-center overflow-hidden hover:-translate-y-2 transition-transform cursor-help relative group" 
                        title={`${p.profile?.username}: ${p.score} Pontos`}
                    >
                        {p.profile?.avatar_url ? (
                          <AvatarImage pathOrUrl={p.profile.avatar_url} alt={p.profile.username} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs font-bold font-display text-white">
                                {p.profile?.username?.substring(0,2).toUpperCase() || `P${i}`}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* --- CENTER: TABLE AREA --- */}
      <div className={`flex-grow relative flex flex-col items-center justify-start pt-10 md:pt-16 p-4 overflow-visible ${
        playedCards.some(card => isMyCard(card)) ? 'pb-40 md:pb-44' : 'pb-64'
      }`}>

        {gameplayError && (
          <div className="mb-6 w-full max-w-4xl border border-violet-700 bg-neutral-950/60 px-4 py-3">
            <p className="text-sm font-serif text-neutral-200">
              <span className="font-display font-bold uppercase tracking-widest text-violet-700">Atenção</span>
              <span className="text-neutral-400"> — </span>
              {gameplayError}
            </p>
          </div>
        )}
        
        {/* Status Label */}
        <div className="mb-8 pointer-events-none z-10">
            <span className={`inline-block px-4 py-1 rounded-full text-xs font-display tracking-widest uppercase transition-colors duration-500 bg-neutral-800 text-neutral-400`}>
            {!round ? (roomData?.status === 'waiting' ? 'Aguardando mais jogadores...' : 'Aguardando início da rodada...') : (round.status === 'picking' ? 'Rodada em andamento' : (round.status === 'judging' ? 'Juiz escolhendo...' : 'Rodada finalizada'))}
            </span>
        </div>

        {/* The Cards on Table */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-16 w-full max-w-6xl justify-center">
            
            {/* Black Card (The Question) */}
            <div ref={blackCardRef} className={`relative z-10 transition-opacity duration-300 ${blackCardVisible ? 'opacity-100' : 'opacity-0'}`}>
                <PlayingCard 
                    variant="black" 
                    text={blackCardText} 
                authorName={round?.black_card?.creator?.username ?? null}
                authorAvatar={round?.black_card?.creator?.avatar_url ?? null}
                    className="shadow-2xl shadow-black/80"
                />
            </div>

            {/* White Cards Played (Respostas jogadas - anônimas até revelação) */}
            {playedCards.length > 0 && (
              <div className="flex flex-wrap gap-6 justify-center max-w-4xl">
                {Object.entries(
                  playedCards.reduce<Record<string, PlayedCard[]>>((acc, card) => {
                    const key = card.submissionId || card.id;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(card);
                    return acc;
                  }, {})
                ).map(([submissionId, pileCards]) => {
                  const sorted = [...pileCards].sort((a, b) => a.submissionSeq - b.submissionSeq);
                  const pileSize = sorted.length;
                  const ui = pileUi[submissionId] ?? { frontIndex: 0, isPeek: false };

                  const rotated = [...sorted.slice(ui.frontIndex), ...sorted.slice(0, ui.frontIndex)].slice(0, 3);
                  const front = rotated[0];
                  const isMine = front ? isMyCard(front) : false;
                  const isWinnerPile = sorted.some(c => c.isWinner);
                  const isRevealedPile = round?.status === 'completed';

                  return (
                    <div
                      key={submissionId}
                      className={`relative w-44 h-60 md:w-52 md:h-72 flex items-center justify-center transition-transform duration-200 ${
                        isWinnerPile ? 'scale-105' : ''
                      } ${isCzar && gameState === 'judging' && !isRevealedPile ? 'cursor-pointer' : ''}`}
                      onMouseEnter={() => setPilePeek(submissionId, true)}
                      onMouseLeave={() => setPilePeek(submissionId, false)}
                      onClick={() => {
                        if (isCzar && gameState === 'judging' && !isRevealedPile) {
                          cyclePile(submissionId, pileSize);
                          // no touch devices, a click is the only way to “peek”
                          setPilePeek(submissionId, true);
                          window.setTimeout(() => setPilePeek(submissionId, false), 1200);
                        }
                      }}
                      onDoubleClick={() => {
                        if (isCzar && gameState === 'judging' && !isRevealedPile) {
                          handleSelectWinner(submissionId);
                        }
                      }}
                    >
                      {/* Stack */}
                      {rotated.map((card, idx) => {
                        const spread = (pileUi[submissionId]?.isPeek ?? false) && pileSize > 1;
                        const dx = spread ? idx * 22 : idx * 6;
                        const dy = spread ? idx * -10 : idx * -3;
                        const rot = spread ? (idx - (rotated.length - 1) / 2) * 3 : 0;
                        const z = 50 - idx;

                        return (
                          <div
                            key={card.id}
                            className="absolute inset-0"
                            style={{
                              transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
                              zIndex: z
                            }}
                          >
                            <PlayingCard
                              variant="white"
                              text={round?.status === 'picking' ? '' : card.text}
                              isFaceDown={round?.status === 'picking'}
                              authorName={card.authorName ?? null}
                              authorAvatar={card.authorAvatar ?? null}
                              className={`shadow-xl hover:scale-100 hover:z-0 ${
                                isWinnerPile ? 'ring-4 ring-white rounded-xl' : ''
                              } ${
                                isMine && !isRevealedPile ? 'ring-2 ring-violet-700 rounded-xl' : ''
                              }`}
                            />
                          </div>
                        );
                      })}

                      {/* Footer label (name hidden until reveal) */}
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                        {isRevealedPile ? (
                          <span className={`text-xs font-serif italic ${isWinnerPile ? 'text-white font-bold' : 'text-neutral-400'}`}>
                            {front?.playerName || '???'}
                          </span>
                        ) : (
                          <span className="text-xs font-serif italic text-neutral-600">???</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* --- BOTTOM: PLAYER HAND --- */}
      <div className={`fixed left-0 right-0 bottom-0 z-[100] pointer-events-none overflow-visible transition-transform duration-500 ${
        playedCards.some(card => isMyCard(card)) ? 'translate-y-24 md:translate-y-28' : 'translate-y-0'
      }`}>
        <div className={`w-full bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-auto overflow-visible transition-all duration-500 ${
          playedCards.some(card => isMyCard(card)) ? 'pt-10 pb-4' : 'pt-24 pb-8'
        }`}>
          {(hand.length > 0 || isCzar) ? (
            <div className={`flex flex-col items-center w-full overflow-visible ${
              playedCards.some(card => isMyCard(card)) ? 'gap-2' : 'gap-4'
            }`}>
              {isCzar && (
                <div className="px-4 py-2 bg-neutral-900/90 border border-neutral-700 rounded-full backdrop-blur-md">
                  <p className="text-neutral-400 font-serif italic text-sm">
                    Você é o juiz desta rodada
                  </p>
                </div>
              )}

              <div className="w-full overflow-visible">
                {/* Tooltip global (não é cortado pelo scroller) */}
                {selectedCardIndex !== null && !isCzar && mySubmittedCount < pickCount && (
                  <div className="pointer-events-none flex justify-center mb-2">
                    <span className="text-xs font-display uppercase tracking-wider text-white bg-black px-3 py-1.5 rounded border border-white">
                      Clique novamente para confirmar ({Math.min(mySubmittedCount + 1, pickCount)}/{pickCount})
                    </span>
                  </div>
                )}

                {/* Horizontal scroller (no vertical scroll). We keep plenty of internal padding so transformed cards never clip. */}
                <div className="no-scrollbar overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth w-full">
                  <div className={`flex items-end justify-center w-max mx-auto px-10 sm:px-16 md:px-36 overflow-visible [--cardOverlap:-2.25rem] sm:[--cardOverlap:-2.75rem] md:[--cardOverlap:-3rem] ${
                    // Extra top padding keeps hover/selected lifts + tooltip fully inside the scroller (no clipping)
                    playedCards.some(card => isMyCard(card)) ? 'pt-20 pb-10' : 'pt-28 pb-16'
                  }`}>
                    <div className="w-8 sm:w-14 md:w-28 flex-shrink-0" />
                    {hand.map((card, index) => {
                      const totalCards = hand.length;
                      const middleIndex = (totalCards - 1) / 2;
                      const offset = index - middleIndex;
                      const rotation = offset * 4;
                      const fanY = Math.abs(offset) * 8;
                      const hasPlayedMyCard = playedCards.some(card => isMyCard(card));
                      const hoverLift = hasPlayedMyCard ? '-1.5rem' : '-3rem';
                      const selectedLift = hasPlayedMyCard ? '-2.25rem' : '-3.75rem';

                      return (
                        <div
                          key={index}
                          className={`relative flex-shrink-0 origin-bottom transition-[filter,opacity] duration-200 ${
                            selectedCardIndex === index
                              ? 'z-[120] [--lift:var(--selectedLift)] [--scale:1.08]'
                              : 'z-10 hover:z-[110] hover:[--lift:var(--hoverLift)] hover:[--scale:1.04]'
                          } ${isCzar ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          [transform:rotate(var(--rot))_translateY(var(--fanY))_translateY(var(--lift,0px))_scale(var(--scale,1))]`}
                          style={{
                            marginLeft: index === 0 ? '0' : 'var(--cardOverlap)',
                            // CSS variables for stable transforms (avoids Tailwind translate + inline transform conflicts)
                            ['--rot' as any]: `${rotation}deg`,
                            ['--fanY' as any]: `${fanY}px`,
                            ['--hoverLift' as any]: hoverLift,
                            ['--selectedLift' as any]: selectedLift
                          }}
                          onClick={() => handlePlayCard(index)}
                        >
                          <PlayingCard
                            variant="white"
                            text={isCzar ? '' : card.text}
                            isFaceDown={isCzar}
                            authorName={card.authorName ?? null}
                            authorAvatar={card.authorAvatar ?? null}
                            className="shadow-2xl hover:scale-100 hover:z-0"
                          />
                        </div>
                      );
                    })}
                    <div className="w-8 sm:w-14 md:w-28 flex-shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-4 px-6 py-3 bg-neutral-900/80 border border-neutral-800 rounded-full backdrop-blur-md">
              <p className="text-neutral-400 font-serif italic text-sm">
                O jogo começará em breve...
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Action */}
      <div className="absolute bottom-4 right-4 z-[60] flex flex-col gap-2">
         <button 
             onClick={() => setIsCreatorModalOpen(true)}
             className="md:hidden w-10 h-10 rounded-full bg-neutral-800 border border-neutral-600 text-white flex items-center justify-center font-bold text-lg shadow-lg"
         >
             +
         </button>
      </div>

    </div>
  );
};

export default GameRoom;