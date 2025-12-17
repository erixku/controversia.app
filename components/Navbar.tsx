import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path ? "text-white opacity-100 border-b border-white" : "text-neutral-400 opacity-70 hover:opacity-100 hover:text-white";
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // Pequeno delay para garantir que o signOut completou
      await new Promise(resolve => setTimeout(resolve, 300));
      // Força reload completo para limpar qualquer estado
      window.location.href = '/#/login';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, tenta redirecionar
      window.location.href = '/#/login';
    }
  };

  // Fecha o menu ao trocar de rota
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Trava o scroll do body enquanto o menu mobile está aberto
  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-neutral-900">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
        <Link to="/" className="text-lg md:text-2xl font-display font-bold tracking-tighter hover:tracking-wide transition-all duration-500">
          CONTROVERSIA
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center space-x-8">
          <Link to="/sobre" className={`text-lg font-serif italic transition-all duration-300 ${isActive('/sobre')}`}>
            O Projeto
          </Link>
          
          {user && (
            <>
              <Link to="/hub" className={`text-lg font-serif italic transition-all duration-300 ${isActive('/hub')}`}>
                Lobby
              </Link>
              <Link to="/decks" className={`text-lg font-serif italic transition-all duration-300 ${isActive('/decks')}`}>
                Decks
              </Link>
              <Link to="/perfil" className={`text-lg font-serif italic transition-all duration-300 ${isActive('/perfil')}`}>
                Perfil
              </Link>
            </>
          )}
          
          {!user ? (
            <Link to="/login" className={`text-lg font-serif italic transition-all duration-300 ${isActive('/login')}`}>
                Entrar
            </Link>
          ) : (
            <button onClick={handleLogout} className="text-lg font-serif italic text-neutral-400 hover:text-violet-700 transition-colors">
                Sair
            </button>
          )}
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden w-10 h-10 border border-neutral-800 hover:border-white transition-colors flex items-center justify-center"
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
        >
          <span className="text-white font-display font-bold text-lg leading-none">{mobileOpen ? '×' : '≡'}</span>
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/80 backdrop-blur-md"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        >
          <div className="max-w-7xl mx-auto px-4 pt-24 pb-10">
            <div
              className="bg-black border border-neutral-800 p-6"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex flex-col gap-6">
              <Link to="/sobre" className={`text-xl font-serif italic transition-all duration-300 ${isActive('/sobre')}`}>
                O Projeto
              </Link>

              {user && (
                <>
                  <Link to="/hub" className={`text-xl font-serif italic transition-all duration-300 ${isActive('/hub')}`}>
                    Lobby
                  </Link>
                  <Link to="/decks" className={`text-xl font-serif italic transition-all duration-300 ${isActive('/decks')}`}>
                    Decks
                  </Link>
                  <Link to="/perfil" className={`text-xl font-serif italic transition-all duration-300 ${isActive('/perfil')}`}>
                    Perfil
                  </Link>
                </>
              )}

              <div className="border-t border-neutral-800 pt-6">
                {!user ? (
                  <Link to="/login" className={`text-xl font-serif italic transition-all duration-300 ${isActive('/login')}`}>
                    Entrar
                  </Link>
                ) : (
                  <button onClick={handleLogout} className="text-xl font-serif italic text-neutral-400 hover:text-violet-700 transition-colors">
                    Sair
                  </button>
                )}
              </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;