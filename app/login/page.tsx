'use client';

import React, { useState, useRef, useEffect } from 'react';
import Input from '../../components/Input';
import Button from '../../components/Button';
import animeBase from 'animejs';
import { supabase } from '../../services/supabase';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const formRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const anime = (animeBase as any).default || animeBase;
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
    setLoading(true);
    setErrorMsg(null);

    const currentOrigin = window.location.origin;

    try {
        if (isRegister) {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: currentOrigin }
            });
            if (error) throw error;
            if (data.user && !data.session) setVerificationSent(true); 
            else if (data.session) router.push('/setup-profile');
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            router.push('/hub');
        }
    } catch (error: any) {
        setErrorMsg(error.message);
    } finally {
        setLoading(false);
    }
  };

  if (verificationSent) {
      return (
        <div className="flex-grow flex items-center justify-center p-6 pt-24">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 p-8 text-center">
                <h2 className="text-2xl font-display font-bold text-white mb-4">Verifique seu E-mail</h2>
                <Button fullWidth onClick={() => window.location.reload()}>Voltar</Button>
            </div>
        </div>
      );
  }

  return (
    <div className="flex-grow flex items-center justify-center p-6 pt-24">
      <div ref={formRef} className="w-full max-w-md bg-black border border-neutral-800 p-8">
        <h2 className="text-3xl font-display font-bold mb-6 text-center">{isRegister ? 'Cadastro' : 'Login'}</h2>
        {errorMsg && <div className="mb-4 text-red-500 text-center text-sm">{errorMsg}</div>}
        <form className="space-y-5" onSubmit={handleAuth}>
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button fullWidth type="submit" disabled={loading}>{loading ? '...' : (isRegister ? 'Cadastrar' : 'Entrar')}</Button>
        </form>
        <button onClick={() => setIsRegister(!isRegister)} className="mt-4 w-full text-center text-sm text-neutral-400 hover:text-white">
            {isRegister ? 'Já tenho conta' : 'Criar conta'}
        </button>
      </div>
    </div>
  );
}