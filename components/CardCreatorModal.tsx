import React, { useState, useEffect, useRef } from 'react';
import animeBase from 'animejs';
import Button from './Button';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CardCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
}

const CardCreatorModal: React.FC<CardCreatorModalProps> = ({ isOpen, onClose, gameId }) => {
  const [cardType, setCardType] = useState<'black' | 'white'>('white');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const anime = (animeBase as any).default || animeBase;
  const { profile } = useAuth();

  useEffect(() => {
    if (isOpen && modalRef.current) {
      anime({
        targets: modalRef.current,
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 400,
        easing: 'easeOutExpo'
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !profile) return;

    setIsSubmitting(true);

    try {
        const { error } = await supabase.from('cards').insert({
            game_id: gameId,
            text: text,
            type: cardType,
            status: 'pending',
            created_by: profile.id
        });

        if (error) throw error;

        // Feedback visual
        const btn = document.getElementById('submit-card-btn');
        if (btn) {
            anime({
                targets: btn,
                scale: [1, 1.1, 1],
                duration: 300,
                complete: () => {
                    setText('');
                    setIsSubmitting(false);
                    onClose();
                    alert('Carta enviada para aprovação do administrador!');
                }
            });
        }
    } catch (error) {
        console.error("Erro ao enviar carta:", error);
        alert("Erro ao enviar sugestão. Tente novamente.");
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Estilos compartilhados
  const cardBaseClasses = "relative w-44 h-60 md:w-56 md:h-72 rounded-xl border-2 flex flex-col justify-between p-4 shadow-2xl transition-colors duration-300";
  const blackCardClasses = "bg-black border-neutral-700 text-white";
  const whiteCardClasses = "bg-white border-neutral-300 text-black";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div 
        ref={modalRef}
        className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl p-6 md:p-8 relative shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="font-display text-9xl font-bold text-white leading-none">?</span>
        </div>

        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-neutral-500 hover:text-violet-700 transition-colors text-2xl"
        >
            ×
        </button>

        <h2 className="text-2xl font-display font-bold text-white mb-2 uppercase">Contribuição ao Caos</h2>
        <p className="text-neutral-400 font-serif italic mb-8 text-sm md:text-base">
            Sua mente perturbada pode ajudar a piorar este jogo. O administrador decidirá se sua carta é digna.
        </p>

        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center justify-center">
            
            <div className="w-full md:w-1/2 flex flex-col space-y-6">
                <div>
                    <label className="text-xs uppercase tracking-widest text-neutral-500 mb-3 block">Tipo de Carta</label>
                    <div className="flex border border-neutral-700 p-1 bg-black/50">
                        <button 
                            onClick={() => setCardType('white')}
                            className={`flex-1 py-2 text-sm font-display font-bold uppercase tracking-wider transition-all ${cardType === 'white' ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}
                        >
                            Resposta (Branca)
                        </button>
                        <button 
                            onClick={() => setCardType('black')}
                            className={`flex-1 py-2 text-sm font-display font-bold uppercase tracking-wider transition-all ${cardType === 'black' ? 'bg-neutral-800 text-white border border-neutral-700' : 'text-neutral-500 hover:text-white'}`}
                        >
                            Pergunta (Preta)
                        </button>
                    </div>
                </div>

                <div>
                    <label className="text-xs uppercase tracking-widest text-neutral-500 mb-2 block">
                        Instruções
                    </label>
                    <ul className="text-sm text-neutral-400 font-serif list-disc pl-4 space-y-1">
                        <li>Seja curto e grosso.</li>
                        <li>Evite piadas internas que ninguém entende.</li>
                        <li>Gramática correta torna a ofensa mais elegante.</li>
                    </ul>
                </div>
            </div>

            <div className="flex flex-col items-center">
                <div className={`${cardBaseClasses} ${cardType === 'black' ? blackCardClasses : whiteCardClasses}`}>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={cardType === 'black' ? "Digite a pergunta aqui..." : "Digite a resposta aqui..."}
                        maxLength={100}
                        className={`
                            w-full h-full bg-transparent resize-none border-none outline-none 
                            font-display font-bold text-lg leading-tight
                            placeholder:opacity-30
                            ${cardType === 'black' ? 'placeholder:text-white' : 'placeholder:text-black'}
                        `}
                    />
                    <div className="flex items-center space-x-1 mt-2 opacity-50 flex-shrink-0 select-none">
                        <span className={`text-[10px] uppercase tracking-widest font-bold ${cardType === 'black' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        Controversia
                        </span>
                    </div>
                </div>
                <span className="text-xs text-neutral-500 mt-2 font-mono">
                    {text.length}/100 caracteres
                </span>
            </div>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-800 flex justify-end">
            <Button variant="ghost" onClick={onClose} className="mr-4">
                Cancelar
            </Button>
            <Button 
                id="submit-card-btn"
                onClick={handleSubmit}
                disabled={!text.trim() || isSubmitting}
                className={!text.trim() ? 'opacity-50 cursor-not-allowed' : ''}
            >
                {isSubmitting ? 'Enviando...' : 'Enviar Sugestão'}
            </Button>
        </div>

      </div>
    </div>
  );
};

export default CardCreatorModal;