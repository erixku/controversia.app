import React, { useState, useRef, useEffect } from 'react';
import Button from './Button';
import animeBase from 'animejs';

interface AvatarEditorProps {
  onSave: (blob: Blob) => void;
}

const AvatarEditor: React.FC<AvatarEditorProps> = ({ onSave }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // URL da imagem recortada final
  const [editorOpen, setEditorOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const anime = (animeBase as any).default || animeBase;

  // Tamanho do output desejado
  const EDITOR_SIZE = 250;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setEditorOpen(true);
      setScale(1);
      setPosition({ x: 0, y: 0 });

      // Carregar imagem para o editor
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          imageRef.current = img;
          drawCanvas();
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, EDITOR_SIZE, EDITOR_SIZE);

    // Fundo preto para áreas vazias
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, EDITOR_SIZE, EDITOR_SIZE);

    const centerX = EDITOR_SIZE / 2;
    const centerY = EDITOR_SIZE / 2;

    ctx.save();
    ctx.translate(centerX + position.x, centerY + position.y);
    ctx.scale(scale, scale);
    ctx.translate(-img.width / 2, -img.height / 2);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  };

  useEffect(() => {
    drawCanvas();
  }, [scale, position, editorOpen]);

  // Mouse / Touch handlers para Pan
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    setPosition({
        x: clientX - dragStart.x,
        y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Gerar blob WebP (melhor compressão)
    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setEditorOpen(false);
        // Animação de sucesso
        const btn = document.getElementById('avatar-trigger');
        if (btn) {
             anime({ targets: btn, scale: [0.8, 1], duration: 400 });
        }
      }
    }, 'image/webp', 0.9);
  };

  return (
    <>
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
      />

      {/* Botão Trigger (Círculo na UI) */}
      <div 
        id="avatar-trigger"
        onClick={() => fileInputRef.current?.click()}
        className="w-24 h-24 rounded-full border border-neutral-700 flex items-center justify-center mb-2 hover:border-white transition-all cursor-pointer group overflow-hidden bg-black relative shadow-xl"
      >
        {previewUrl ? (
            <img src={previewUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
        ) : (
            <span className="text-4xl font-light text-neutral-700 group-hover:text-white transition-colors">+</span>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <span className="text-[10px] uppercase font-bold text-white">Alterar</span>
        </div>
      </div>
      <span className="text-xs uppercase tracking-widest text-neutral-500 mb-6 block">
         {previewUrl ? 'Foto Definida' : 'Foto de Perfil'}
      </span>

      {/* Modal de Edição */}
      {editorOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col items-center animate-in fade-in zoom-in duration-300 rounded-lg">
                <div className="p-6 md:p-8 w-full flex flex-col items-center">
                    <h3 className="font-display font-bold text-white uppercase mb-6 tracking-wider text-xl">Ajuste sua Imagem</h3>
                    
                    {/* Canvas Area */}
                    <div 
                        className="border-2 border-white rounded-full overflow-hidden cursor-move mb-8 relative shadow-2xl shrink-0"
                        style={{ width: EDITOR_SIZE, height: EDITOR_SIZE }}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onTouchMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onTouchEnd={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <canvas 
                            ref={canvasRef} 
                            width={EDITOR_SIZE} 
                            height={EDITOR_SIZE} 
                        />
                        <div className="absolute inset-0 pointer-events-none rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]" />
                    </div>

                    {/* Controls */}
                    <div className="w-full px-2 mb-8">
                        <div className="flex justify-between mb-2">
                             <label className="text-xs uppercase text-neutral-500 block">Zoom</label>
                             <span className="text-xs font-mono text-neutral-500">{Math.round(scale * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.5" 
                            max="3" 
                            step="0.1" 
                            value={scale} 
                            onChange={(e) => setScale(parseFloat(e.target.value))}
                            className="w-full accent-white bg-neutral-800 h-1 appearance-none rounded-lg cursor-pointer"
                        />
                    </div>

                    <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 w-full">
                        <Button variant="ghost" fullWidth onClick={() => setEditorOpen(false)}>
                            Cancelar
                        </Button>
                        <Button fullWidth onClick={handleConfirm}>
                            Confirmar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default AvatarEditor;