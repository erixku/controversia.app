import React, { useState, useRef, useEffect } from 'react';
import Input from '../components/Input';
import Button from '../components/Button';
import animeBase from 'animejs';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationSent, setVerificationSent] = useState(false); // Novo estado para tela de confirmação
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const formRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const anime = (animeBase as any).default || animeBase;
    
    // Limpar mensagens ao trocar de modo
    setErrorMsg(null);
    setSuccessMsg(null);
    setVerificationSent(false);
    setUseMagicLink(false);

    if (formRef.current && anime) {
        anime({
          targets: formRef.current,
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 600,
          easing: 'easeOutQuad'
        });
    }
  }, [isRegister]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSupabaseConfigured) {
        setErrorMsg("CONFIGURAÇÃO PENDENTE: Verifique services/supabase.ts");
        return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Identifica a URL atual para garantir que o redirecionamento volte para este ambiente (importante para ambientes como Bolt.new)
    const currentOrigin = window.location.origin;

    try {
        if (useMagicLink) {
            // --- FLUXO DE MAGIC LINK ---
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    // Redireciona para a raiz. O AuthCallbackHandler no App.tsx decidirá o destino (Hub ou Setup)
                    emailRedirectTo: currentOrigin,
                }
            });

            if (error) throw error;
            setVerificationSent(true);
            setSuccessMsg('Link mágico enviado! Verifique seu e-mail.');

        } else if (isRegister) {
            // --- FLUXO DE CADASTRO (ETAPA 1) ---
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    // Redireciona para a raiz. O AuthCallbackHandler enviará para SetupProfile pois não haverá perfil ainda.
                    emailRedirectTo: currentOrigin, 
                }
            });

            if (error) throw error;

            // Se o usuário foi criado mas não tem sessão, precisa confirmar email
            if (data.user && !data.session) {
                setVerificationSent(true); 
            } else if (data.session) {
                navigate('/setup-profile');
            }

        } else {
            // --- FLUXO DE LOGIN ---
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            
            // Garantir que o profile existe (UPSERT)
            if (data.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        auth_id: data.user.id,
                        username: data.user.email?.split('@')[0] || 'usuario',
                        avatar_url: null,
                        updated_at: new Date().toISOString(),
                    }, {
                        onConflict: 'auth_id',
                        ignoreDuplicates: false
                    });
                
                if (profileError) console.warn('Erro ao criar profile:', profileError);
            }
            
            // Verifica perfil antes de redirecionar
            const { data: profileData } = await supabase
                .from('profiles')
                .select('username')
                .eq('auth_id', data.user.id)
                .single();

            if (profileData && profileData.username) {
                navigate('/hub');
            } else {
                navigate('/setup-profile');
            }
        }
    } catch (error: any) {
        console.error("Erro de Autenticação:", error);
        
        let msg = error.message;
        if (msg === "Invalid login credentials") msg = "E-mail ou senha incorretos.";
        else if (msg.includes("User already registered")) msg = "Este e-mail já possui conta.";
        else if (msg.includes("rate limit")) msg = "Muitas tentativas. Aguarde um momento.";
        
        setErrorMsg(msg);
    } finally {
        setLoading(false);
    }
  };

  // Renderização da Tela de Confirmação de E-mail
  if (verificationSent) {
      return (
      <div className="flex-grow flex items-center justify-center px-4 sm:px-6 py-6 pt-24 relative">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 p-6 sm:p-8 text-center shadow-2xl animate-in fade-in zoom-in duration-500">
                <div className="mb-6 flex justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-3xl font-display font-bold">@</span>
                    </div>
                </div>
                <h2 className="text-2xl font-display font-bold text-white mb-4 uppercase">Verifique seu E-mail</h2>
                <p className="font-serif text-neutral-300 mb-6">
                    Um link de confirmação foi enviado para <strong>{email}</strong>.
                </p>
                <div className="bg-black/50 p-4 border border-neutral-800 mb-8 text-sm text-neutral-400 text-left">
                    <p className="mb-2 font-bold uppercase text-xs tracking-widest text-neutral-500">Importante:</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Certifique-se de usar este mesmo navegador/dispositivo para clicar no link.</li>
                        <li>Verifique a caixa de <strong>SPAM</strong>.</li>
                    </ul>
                </div>
                <Button fullWidth onClick={() => window.location.reload()}>
                    Voltar para Login
                </Button>
            </div>
        </div>
      );
  }

  return (
    <div className="flex-grow flex items-center justify-center px-4 sm:px-6 py-6 pt-24 relative">
        <div className="absolute left-0 bottom-0 w-64 h-64 border-t border-r border-neutral-800 rounded-tr-full opacity-30 pointer-events-none" />
        <div className="absolute right-0 top-0 w-64 h-64 md:w-96 md:h-96 border-b border-l border-neutral-800 rounded-bl-full opacity-30 pointer-events-none" />

      <div ref={formRef} className="w-full max-w-md bg-black border border-neutral-800 p-6 sm:p-8 md:p-12 relative z-10 auth-form shadow-2xl">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-display font-bold mb-2 uppercase">
            {isRegister ? 'Passo 1: Acesso' : 'Acesso ao Sistema'}
          </h2>
          <p className="font-serif italic text-neutral-500">
            {isRegister ? 'Primeiro, crie suas credenciais.' : 'Bem-vindo de volta, mente perturbada.'}
          </p>
        </div>

        {errorMsg && (
            <div className="mb-6 p-3 border border-violet-700 bg-violet-700/10 text-violet-700 text-xs font-display tracking-widest text-center uppercase break-words animate-pulse">
                {errorMsg}
            </div>
        )}

        {successMsg && (
            <div className="mb-6 p-4 border border-neutral-600 bg-neutral-800 text-white text-sm font-serif text-center leading-relaxed">
                {successMsg}
            </div>
        )}

        <form className="space-y-5" onSubmit={handleAuth}>
          <Input 
            label="E-mail" 
            type="email" 
            placeholder="exemplo@vazio.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          {!useMagicLink && (
            <Input 
              label="Senha" 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          )}

          <Button fullWidth type="submit" disabled={loading} className={`mt-4 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {loading ? 'Processando...' : (useMagicLink ? 'Enviar Link Mágico' : isRegister ? 'Cadastrar' : 'Entrar')}
          </Button>

          {!isRegister && (
            <button
              type="button"
              onClick={() => setUseMagicLink(!useMagicLink)}
              className="w-full text-center text-sm font-serif text-neutral-400 hover:text-white transition-colors mt-3 underline"
            >
              {useMagicLink ? 'Usar senha' : 'Entrar com link mágico (sem senha)'}
            </button>
          )}
        </form>

        <div className="mt-8 text-center border-t border-neutral-900 pt-6">
          <p className="font-serif text-neutral-400">
            {isRegister ? 'Já possui cadastro?' : 'Não tem uma conta?'}
            <button 
              onClick={() => setIsRegister(!isRegister)} 
              className="ml-2 font-display text-white border-b border-transparent hover:border-white transition-all uppercase text-xs font-bold tracking-widest"
            >
              {isRegister ? 'Fazer Login' : 'Cadastrar-se'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;