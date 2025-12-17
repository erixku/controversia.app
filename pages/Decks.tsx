import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';

interface Deck {
  id: string;
  name: string;
  created_at: string;
  is_default: boolean;
  clone_token: string | null;
  visibility: 'private' | 'public';
  _count?: { cards: number };
}

const Decks: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [deckVisibility, setDeckVisibility] = useState<'private' | 'public'>('private');
  const [cloneToken, setCloneToken] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDecks();
  }, [profile]);

  const fetchDecks = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('decks')
        .select(`
          *,
          deck_cards(count)
        `)
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Processar contagem de cartas
      const decksWithCount = (data || []).map(deck => ({
        ...deck,
        _count: { cards: deck.deck_cards?.[0]?.count || 0 }
      }));

      setDecks(decksWithCount);
    } catch (err: any) {
      console.error('Erro ao buscar decks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeck = async () => {
    if (!deckName.trim() || !profile) return;

    setCreating(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('decks')
        .insert({
          name: deckName.trim(),
          created_by: profile.id,
          visibility: deckVisibility,
          is_default: decks.length === 0 // Primeiro deck é padrão
        })
        .select()
        .single();

      if (error) throw error;

      setShowCreateModal(false);
      setDeckName('');
      setDeckVisibility('private');
      fetchDecks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCloneDeck = async () => {
    if (!cloneToken.trim() || !profile) return;

    setCreating(true);
    setError(null);

    try {
      // Buscar deck pelo clone_token
      const { data: sourceDeck, error: deckError } = await supabase
        .from('decks')
        .select('*')
        .eq('clone_token', cloneToken.trim())
        .single();

      if (deckError) throw new Error('Código inválido ou deck não encontrado');

      // Buscar cartas do deck
      const { data: sourceCards, error: cardsError } = await supabase
        .from('deck_cards')
        .select('*')
        .eq('deck_id', sourceDeck.id)
        .eq('status', 'approved');

      if (cardsError) throw cardsError;

      // Criar novo deck (clone)
      const { data: newDeck, error: createError } = await supabase
        .from('decks')
        .insert({
          name: `${sourceDeck.name} (Clone)`,
          created_by: profile.id,
          visibility: 'private',
          is_default: false
        })
        .select()
        .single();

      if (createError) throw createError;

      // Copiar cartas
      if (sourceCards && sourceCards.length > 0) {
        const cardsToInsert = sourceCards.map(card => ({
          deck_id: newDeck.id,
          type: card.type,
          text: card.text,
          position: card.position,
          created_by: profile.id,
          status: 'approved'
        }));

        const { error: insertError } = await supabase
          .from('deck_cards')
          .insert(cardsToInsert);

        if (insertError) throw insertError;
      }

      setShowCloneModal(false);
      setCloneToken('');
      fetchDecks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSetDefault = async (deckId: string) => {
    if (!profile) return;

    try {
      // Remover is_default de todos os decks do usuário
      await supabase
        .from('decks')
        .update({ is_default: false })
        .eq('created_by', profile.id);

      // Setar o deck selecionado como padrão
      const { error } = await supabase
        .from('decks')
        .update({ is_default: true })
        .eq('id', deckId);

      if (error) throw error;

      fetchDecks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteDeck = async (deckId: string, deckName: string) => {
    if (!confirm(`Tem certeza que deseja apagar o deck "${deckName}"?\n\nTodas as cartas serão perdidas.`)) return;

    try {
      const { error } = await supabase
        .from('decks')
        .delete()
        .eq('id', deckId);

      if (error) throw error;

      fetchDecks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const generateCloneToken = async (deckId: string) => {
    try {
      const token = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { error } = await supabase
        .from('decks')
        .update({ clone_token: token })
        .eq('id', deckId);

      if (error) throw error;

      fetchDecks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white font-display uppercase animate-pulse">Carregando decks...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-20 md:py-36">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold uppercase mb-2">Meus Decks</h1>
            <p className="text-neutral-400 font-serif">Gerencie suas coleções de cartas</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowCloneModal(true)}
              className="px-4 py-2 border border-neutral-700 text-white hover:border-white transition-colors font-display font-bold uppercase"
            >
              Importar Deck
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-white text-black hover:bg-neutral-200 transition-colors font-display font-bold uppercase"
            >
              + Criar Deck
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 border border-violet-700 bg-violet-700/10 text-violet-700 text-sm">
            {error}
          </div>
        )}

        {/* Decks Grid */}
        {decks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-500 font-serif text-lg mb-6">Você ainda não tem nenhum deck.</p>
            <Button onClick={() => setShowCreateModal(true)}>Criar Primeiro Deck</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {decks.map(deck => (
              <div
                key={deck.id}
                className="border border-neutral-800 bg-neutral-900 p-6 hover:border-neutral-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-xl mb-1">{deck.name}</h3>
                    <p className="text-sm text-neutral-500 font-serif">
                      {deck._count?.cards || 0} cartas
                    </p>
                  </div>
                  {deck.is_default && (
                    <span className="px-2 py-1 bg-neutral-800 text-white border border-neutral-600 text-xs font-display font-bold uppercase">
                      Padrão
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs px-2 py-1 ${
                    deck.visibility === 'public' 
                      ? 'bg-neutral-800 text-white border border-neutral-600' 
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}>
                    {deck.visibility === 'public' ? 'Público' : 'Privado'}
                  </span>
                  {deck.clone_token && (
                    <span className="text-xs px-2 py-1 bg-neutral-800 text-neutral-300 border border-neutral-600 font-mono">
                      {deck.clone_token}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/decks/${deck.id}`)}
                    className="flex-1 px-3 py-2 border border-neutral-700 hover:border-white transition-colors text-sm font-display font-bold uppercase"
                  >
                    Gerenciar
                  </button>
                  {!deck.is_default && (
                    <button
                      onClick={() => handleSetDefault(deck.id)}
                      className="px-3 py-2 border border-neutral-700 hover:border-white hover:text-white transition-colors text-sm font-display font-bold"
                      title="Definir como padrão"
                    >
                      Padrão
                    </button>
                  )}
                  {!deck.clone_token && (
                    <button
                      onClick={() => generateCloneToken(deck.id)}
                      className="px-3 py-2 border border-neutral-700 hover:border-white hover:text-white transition-colors text-sm font-display font-bold"
                      title="Gerar código de compartilhamento"
                    >
                      Código
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteDeck(deck.id, deck.name)}
                    className="px-3 py-2 border border-neutral-700 hover:border-violet-700 hover:text-violet-700 transition-colors text-sm font-display font-bold"
                    title="Apagar deck"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Modal Criar Deck */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-md w-full">
            <div className="border-b border-neutral-800 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold uppercase">Criar Novo Deck</h2>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setDeckName('');
                  setError(null);
                }}
                className="text-2xl hover:text-violet-700 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block font-display text-sm font-bold uppercase tracking-wider mb-2 text-neutral-300">
                  Nome do Deck
                </label>
                <input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 px-4 py-3 text-white focus:outline-none focus:border-white font-serif"
                  placeholder="Ex: Deck Pesado"
                  maxLength={50}
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-display text-sm font-bold uppercase tracking-wider mb-3 text-neutral-300">
                  Visibilidade
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setDeckVisibility('private')}
                    className={`w-full text-left p-3 border transition-all ${
                      deckVisibility === 'private'
                        ? 'border-white bg-white/5'
                        : 'border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <span className="font-display font-bold">Privado</span>
                  </button>
                  <button
                    onClick={() => setDeckVisibility('public')}
                    className={`w-full text-left p-3 border transition-all ${
                      deckVisibility === 'public'
                        ? 'border-white bg-white/5'
                        : 'border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <span className="font-display font-bold">Público</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setDeckName('');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-3 border border-neutral-700 text-neutral-400 hover:text-white hover:border-white transition-colors font-display font-bold uppercase"
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateDeck}
                  disabled={creating || !deckName.trim()}
                  className="flex-1 px-4 py-3 bg-white text-black font-display font-bold uppercase hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Clonar Deck */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-md w-full">
            <div className="border-b border-neutral-800 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold uppercase">Importar Deck</h2>
              <button 
                onClick={() => {
                  setShowCloneModal(false);
                  setCloneToken('');
                  setError(null);
                }}
                className="text-2xl hover:text-violet-700 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block font-display text-sm font-bold uppercase tracking-wider mb-2 text-neutral-300">
                  Código do Deck
                </label>
                <input
                  type="text"
                  value={cloneToken}
                  onChange={(e) => setCloneToken(e.target.value.toUpperCase())}
                  className="w-full bg-neutral-800 border border-neutral-700 px-4 py-3 text-white focus:outline-none focus:border-white font-mono text-center text-xl tracking-widest"
                  placeholder="ABC123XY"
                  maxLength={20}
                  autoFocus
                />
                <p className="text-xs text-neutral-500 mt-2 font-serif italic">
                  Cole o código de compartilhamento fornecido pelo criador do deck.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCloneModal(false);
                    setCloneToken('');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-3 border border-neutral-700 text-neutral-400 hover:text-white hover:border-white transition-colors font-display font-bold uppercase"
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCloneDeck}
                  disabled={creating || !cloneToken.trim()}
                  className="flex-1 px-4 py-3 bg-white text-black font-display font-bold uppercase hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Decks;
