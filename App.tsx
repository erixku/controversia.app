import React, { ReactNode, ErrorInfo, useEffect, Component } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import SetupProfile from './pages/SetupProfile';
import Profile from './pages/Profile';
import GameHub from './pages/GameHub';
import GameRoom from './pages/GameRoom';
import Decks from './pages/Decks';
import DeckEditor from './pages/DeckEditor';
import ProjectOverview from './pages/ProjectOverview';
import { AuthProvider, useAuth } from './contexts/AuthContext';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-6 text-center">
            <div>
                <h1 className="text-3xl font-display text-violet-700 mb-4">CRITICAL ERROR</h1>
                <p className="font-serif italic text-neutral-400 mb-4">O caos foi longe demais.</p>
                <code className="block bg-neutral-900 p-4 rounded text-left text-xs mb-6 overflow-auto max-w-lg">
                    {this.state.error?.message}
                </code>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-white text-black font-display font-bold uppercase tracking-widest hover:bg-neutral-200"
                >
                    Reiniciar Sistema
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Componente especial para processar o retorno do login via e-mail
const AuthCallbackHandler = () => {
    const { user, profile, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && user) {
            // Sempre vai para setup-profile primeiro
            // Se já tiver perfil completo, o próprio SetupProfile pode redirecionar
            navigate('/setup-profile');
        } else if (!loading && !user) {
            // Se não conseguiu autenticar, volta para login
            setTimeout(() => navigate('/login'), 2000);
        }
    }, [user, loading, navigate]);

    return (
        <div className="flex items-center justify-center h-screen bg-black text-white">
            <div className="text-center animate-pulse">
                <h2 className="text-xl font-display font-bold mb-2">AUTENTICANDO</h2>
                <p className="font-serif italic text-neutral-500">Validando sua existência...</p>
            </div>
        </div>
    );
};

const AppContent: React.FC = () => {
  const location = useLocation();

  // Verifica se o HashRouter interpretou o token do Supabase como uma rota
  // Ex: #access_token=... vira a rota "/access_token=..."
  const isAuthRedirect = location.pathname.includes('access_token') || location.pathname.includes('error_description');

  if (isAuthRedirect) {
      return <AuthCallbackHandler />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-white selection:bg-white selection:text-black">
      {/* Navbar visível apenas fora da sala de jogo para imersão total */}
      <Routes>
        <Route path="/game/:id" element={<></>} />
        <Route path="*" element={<Navbar />} />
      </Routes>
      
      <main className="flex-grow flex flex-col relative overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/setup-profile" element={<SetupProfile />} />
          <Route path="/hub" element={<GameHub />} />
          <Route path="/game/:id" element={<GameRoom />} />
          <Route path="/decks" element={<Decks />} />
          <Route path="/decks/:id" element={<DeckEditor />} />
          <Route path="/sobre" element={<ProjectOverview />} />
          
          {/* Captura qualquer rota estranha gerada pelo redirect e joga para Home/Handler */}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      
      {/* Footer oculto na sala de jogo */}
      <Routes>
         <Route path="/game/:id" element={<></>} />
         <Route path="*" element={
            <footer className="py-6 border-t border-neutral-800 text-center text-neutral-500 text-sm italic">
                <p>© 2024 CONTROVERSIA. Todos os direitos reservados. Design Brutalista Minimalista.</p>
            </footer>
         } />
      </Routes>
    </div>
  );
};
export default function App() {
  return (
    <ErrorBoundary>
        <AuthProvider>
            <Router>
                <AppContent />
            </Router>
        </AuthProvider>
    </ErrorBoundary>
  );
}