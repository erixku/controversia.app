import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import PlayingCard from '../components/PlayingCard';

interface DeckCard {
  id: string;
  deck_id: string;
  type: 'black' | 'white';
  text: string;
  position: number | null;
  status: string;
  created_at: string;
}

interface Deck {
  id: string;
  name: string;
  created_by: string;
  is_default: boolean;
  clone_token: string | null;
  visibility: 'private' | 'public';
  created_at: string;
}

const DeckEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cardType, setCardType] = useState<'black' | 'white'>('white');
  const [cardText, setCardText] = useState('');
  const [editingCard, setEditingCard] = useState<DeckCard | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'black' | 'white'>('all');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (id && profile) {
      fetchDeck();
      fetchCards();
    }
  }, [id, profile]);

  const fetchDeck = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('decks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Verificar se o usuário é o dono
      if (data.created_by !== profile?.id) {
        alert('Você não tem permissão para editar este deck.');
        navigate('/decks');
        return;
      }

      setDeck(data);
    } catch (err: any) {
      console.error('Erro ao buscar deck:', err);
      setError(err.message);
    }
  };

  const fetchCards = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('deck_cards')
        .select('*')
        .eq('deck_id', id)
        .order('position', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCards(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar cartas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async () => {
    if (!cardText.trim() || !id || !profile) return;

    setCreating(true);
    setError(null);

    try {
      const maxPosition = cards.length > 0 
        ? Math.max(...cards.map(c => c.position || 0))
        : 0;

      const { error } = await supabase
        .from('deck_cards')
        .insert({
          deck_id: id,
          type: cardType,
          text: cardText.trim(),
          position: maxPosition + 1,
          created_by: profile.id,
          status: 'approved'
        });

      if (error) throw error;

      setShowAddModal(false);
      setCardText('');
      setCardType('white');
      fetchCards();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEditCard = async () => {
    if (!editingCard || !cardText.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('deck_cards')
        .update({
          text: cardText.trim(),
          type: cardType
        })
        .eq('id', editingCard.id);

      if (error) throw error;

      setEditingCard(null);
      setCardText('');
      setCardType('white');
      fetchCards();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Tem certeza que deseja remover esta carta?')) return;

    try {
      const { error } = await supabase
        .from('deck_cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;
      fetchCards();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id || !profile) return;

    setImporting(true);
    setError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validar estrutura
      if (!data.brancas || !data.pretas) {
        throw new Error('Arquivo JSON inválido. Deve conter as propriedades "brancas" e "pretas".');
      }

      if (!Array.isArray(data.brancas) || !Array.isArray(data.pretas)) {
        throw new Error('As propriedades "brancas" e "pretas" devem ser arrays de strings.');
      }

      // Calcular posição inicial
      const maxPosition = cards.length > 0 
        ? Math.max(...cards.map(c => c.position || 0))
        : 0;

      let position = maxPosition + 1;
      const cardsToInsert: any[] = [];

      // Adicionar cartas brancas
      data.brancas.forEach((text: string) => {
        if (text && text.trim()) {
          cardsToInsert.push({
            deck_id: id,
            type: 'white',
            text: text.trim(),
            position: position++,
            created_by: profile.id,
            status: 'approved'
          });
        }
      });

      // Adicionar cartas pretas
      data.pretas.forEach((text: string) => {
        if (text && text.trim()) {
          cardsToInsert.push({
            deck_id: id,
            type: 'black',
            text: text.trim(),
            position: position++,
            created_by: profile.id,
            status: 'approved'
          });
        }
      });

      if (cardsToInsert.length === 0) {
        throw new Error('Nenhuma carta válida encontrada no arquivo.');
      }

      // Inserir no banco
      const { error } = await supabase
        .from('deck_cards')
        .insert(cardsToInsert);

      if (error) throw error;

      alert(`${cardsToInsert.length} cartas importadas com sucesso!\n${data.brancas.length} brancas e ${data.pretas.length} pretas.`);
      fetchCards();
    } catch (err: any) {
      setError(err.message || 'Erro ao importar arquivo JSON');
      alert(`Erro: ${err.message}`);
    } finally {
      setImporting(false);
      // Limpar input
      event.target.value = '';
    }
  };

  const openEditModal = (card: DeckCard) => {
    setEditingCard(card);
    setCardText(card.text);
    setCardType(card.type);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingCard(null);
    setCardText('');
    setCardType('white');
    setError(null);
  };

  const filteredCards = cards.filter(card => {
    if (filterType === 'all') return true;
    return card.type === filterType;
  });

  const blackCards = cards.filter(c => c.type === 'black');
  const whiteCards = cards.filter(c => c.type === 'white');

  if (loading && !deck) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white font-display uppercase animate-pulse">Carregando deck...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-28 md:py-36">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/decks')}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              ← Voltar
            </button>
            <div>
              <h1 className="text-4xl md:text-5xl font-display font-bold uppercase">{deck?.name}</h1>
              <p className="text-neutral-400 font-serif mt-2">
                {cards.length} cartas • {blackCards.length} pretas • {whiteCards.length} brancas
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <label className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                disabled={importing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <button
                disabled={importing}
                className="px-4 py-2 border border-neutral-700 text-white hover:border-white transition-colors font-display font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importando...' : 'Importar JSON'}
              </button>
            </label>
            <button
              onClick={() => {
                setEditingCard(null);
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-white text-black hover:bg-neutral-200 transition-colors font-display font-bold uppercase"
            >
              + Adicionar
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 border border-violet-700 bg-violet-700/10 text-violet-700 text-sm">
            {error}
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 font-display font-bold uppercase text-sm transition-colors ${
              filterType === 'all'
                ? 'bg-white text-black'
                : 'border border-neutral-700 text-neutral-400 hover:border-white hover:text-white'
            }`}
          >
            Todas ({cards.length})
          </button>
          <button
            onClick={() => setFilterType('black')}
            className={`px-4 py-2 font-display font-bold uppercase text-sm transition-colors ${
              filterType === 'black'
                ? 'bg-neutral-800 text-white border border-neutral-600'
                : 'border border-neutral-700 text-neutral-400 hover:border-white hover:text-white'
            }`}
          >
            Pretas ({blackCards.length})
          </button>
          <button
            onClick={() => setFilterType('white')}
            className={`px-4 py-2 font-display font-bold uppercase text-sm transition-colors ${
              filterType === 'white'
                ? 'bg-white text-black'
                : 'border border-neutral-700 text-neutral-400 hover:border-white hover:text-white'
            }`}
          >
            Brancas ({whiteCards.length})
          </button>
        </div>

        {/* Cards Grid */}
        {filteredCards.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-neutral-800">
            <p className="text-neutral-500 font-serif text-lg mb-6">
              {filterType === 'all' 
                ? 'Nenhuma carta ainda. Adicione a primeira!'
                : `Nenhuma carta ${filterType === 'black' ? 'preta' : 'branca'} ainda.`
              }
            </p>
            <button
              onClick={() => {
                setCardType(filterType === 'all' ? 'white' : filterType);
                setShowAddModal(true);
              }}
              className="px-6 py-3 bg-white text-black font-display font-bold uppercase hover:bg-neutral-200 transition-colors"
            >
              Adicionar Carta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredCards.map(card => (
              <div key={card.id} className="relative group">
                <PlayingCard
                  text={card.text}
                  variant={card.type}
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => openEditModal(card)}
                    className="w-8 h-8 bg-neutral-800 border border-neutral-600 text-white rounded-full flex items-center justify-center hover:border-white text-xs font-display font-bold"
                    title="Editar"
                  >
                    Ed
                  </button>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="w-8 h-8 bg-neutral-800 border border-neutral-600 text-white rounded-full flex items-center justify-center hover:border-violet-700 hover:text-violet-700 text-xs font-display font-bold"
                    title="Remover"
                  >
                    X
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Modal Add/Edit Card */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4 md:p-6 flex justify-between items-center">
              <h2 className="text-xl md:text-2xl font-display font-bold uppercase">
                {editingCard ? 'Editar Carta' : 'Nova Carta'}
              </h2>
              <button 
                onClick={closeModal}
                className="text-2xl hover:text-violet-700 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              {error && (
                <div className="p-3 border border-violet-700 bg-violet-700/10 text-violet-700 text-sm">
                  {error}
                </div>
              )}

              {/* Tipo de Carta */}
              <div>
                <label className="block font-display text-xs font-bold uppercase tracking-wider mb-2 text-neutral-300">
                  Tipo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCardType('white')}
                    className={`p-3 border-2 transition-all ${
                      cardType === 'white'
                        ? 'border-white bg-white text-black'
                        : 'border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div className="font-display font-bold text-sm">Branca</div>
                    <div className="text-xs mt-1 opacity-70">Resposta</div>
                  </button>
                  <button
                    onClick={() => setCardType('black')}
                    className={`p-3 border-2 transition-all ${
                      cardType === 'black'
                        ? 'border-neutral-600 bg-neutral-800 text-white'
                        : 'border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div className="font-display font-bold text-sm">Preta</div>
                    <div className="text-xs mt-1 opacity-70">Pergunta</div>
                  </button>
                </div>
              </div>

              {/* Texto da Carta */}
              <div>
                <label className="block font-display text-xs font-bold uppercase tracking-wider mb-2 text-neutral-300">
                  Texto
                </label>
                <textarea
                  value={cardText}
                  onChange={(e) => setCardText(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 text-white focus:outline-none focus:border-white font-serif text-sm resize-none"
                  placeholder={cardType === 'black' ? 'Ex: _____ me fez perder a fé na humanidade.' : 'Ex: Bolsonaro dançando funk'}
                  maxLength={200}
                  rows={4}
                  autoFocus
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-neutral-500 font-serif italic">
                    {cardType === 'black' ? 'Use _____ para lacunas' : 'Seja criativo'}
                  </p>
                  <p className="text-xs text-neutral-500 font-mono">
                    {cardText.length}/200
                  </p>
                </div>
              </div>

              {/* Preview Compacto */}
              {cardText.trim() && (
                <div>
                  <label className="block font-display text-xs font-bold uppercase tracking-wider mb-2 text-neutral-300">
                    Preview
                  </label>
                  <div className="flex justify-center scale-75 md:scale-90">
                    <PlayingCard
                      text={cardText}
                      variant={cardType}
                    />
                  </div>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-neutral-700 text-neutral-400 hover:text-white hover:border-white transition-colors font-display font-bold uppercase text-sm"
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  onClick={editingCard ? handleEditCard : handleAddCard}
                  disabled={creating || !cardText.trim()}
                  className="flex-1 px-4 py-2 bg-white text-black font-display font-bold uppercase hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {creating ? 'Salvando...' : editingCard ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckEditor;
