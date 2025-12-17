import React from 'react';
import AvatarImage from './AvatarImage';

export type CardVariant = 'black' | 'white';

interface PlayingCardProps {
  id?: string;
  text?: string;
  variant: CardVariant;
  isFaceDown?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  authorName?: string | null;
  authorAvatar?: string | null;
}

const PlayingCard: React.FC<PlayingCardProps> = ({
  text,
  variant,
  isFaceDown = false,
  isSelected = false,
  onClick,
  className = '',
  style = {},
  authorName = null,
  authorAvatar = null
}) => {
  // Base classes for shape and border
  const baseClasses = "relative w-36 h-52 md:w-44 md:h-60 rounded-xl border-2 flex flex-col justify-between p-3 md:p-4 transition-transform duration-300 select-none shadow-xl cursor-pointer preserve-3d bg-clip-padding";
  
  // Specific styles based on variant
  const variantClasses = variant === 'black' 
    ? "bg-black border-neutral-800 text-white" 
    : "bg-white border-neutral-300 text-black";

  // Selected state
  const selectedClasses = isSelected 
    ? "ring-4 ring-offset-4 ring-offset-black ring-white transform -translate-y-4 z-50" 
    : "";

  // Back of card design - Agora dinâmico baseado na variante
  const backBgClass = variant === 'black' ? 'bg-black border-neutral-800' : 'bg-white border-neutral-200';
  const backTextClass = variant === 'black' ? 'text-neutral-800' : 'text-neutral-200';

  const cardBack = (
    <div className={`absolute inset-0 w-full h-full ${backBgClass} border-2 rounded-xl flex items-center justify-center backface-hidden ${className}`}>
      <div className="text-center transform rotate-45">
        <span className={`font-display font-bold text-2xl tracking-widest uppercase ${backTextClass}`}>
          Contro<br/>versia
        </span>
      </div>
    </div>
  );

  if (isFaceDown) {
    return (
      <div onClick={onClick} className={`${baseClasses} ${backBgClass} ${className}`} style={style}>
         {cardBack}
      </div>
    );
  }

  return (
    <div 
      onClick={onClick} 
      className={`${baseClasses} ${variantClasses} ${selectedClasses} ${className} hover:scale-105 hover:z-[100]`}
      style={style}
    >
      <div className="flex-grow overflow-hidden">
        {/* Fonte reduzida e quebra de palavra forçada */}
        <p className="font-bold font-display text-sm leading-snug md:text-base break-words whitespace-pre-wrap">
            {text}
        </p>
      </div>
      
      {/* Rodapé com criador ou marca padrão */}
      <div className="flex items-center justify-between mt-2 flex-shrink-0 gap-2">
        {authorName ? (
          <div className="flex items-center gap-1.5 opacity-70">
            {authorAvatar && (
              <AvatarImage
                pathOrUrl={authorAvatar}
                alt={authorName}
                className="w-4 h-4 rounded-full object-cover border border-current"
              />
            )}
            <span className={`text-[9px] font-display font-bold uppercase tracking-wider truncate max-w-[80px] ${variant === 'black' ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {authorName}
            </span>
          </div>
        ) : (
          <span className={`text-[10px] uppercase tracking-widest font-bold opacity-50 ${variant === 'black' ? 'text-neutral-500' : 'text-neutral-400'}`}>
            Controversia
          </span>
        )}
      </div>
    </div>
  );
};

export default PlayingCard;