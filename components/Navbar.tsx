import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();

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

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-neutral-900">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="text-2xl font-display font-bold tracking-tighter hover:tracking-wide transition-all duration-500">
          CONTROVERSIA
        </Link>

        <div className="flex items-center space-x-8">
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
      </div>
    </nav>
  );
};

export default Navbar;