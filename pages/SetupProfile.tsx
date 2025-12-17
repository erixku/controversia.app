import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../components/Input';
import Button from '../components/Button';
import AvatarEditor from '../components/AvatarEditor';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

const SetupProfile: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Se já tiver perfil carregado, pré-preenche
  useEffect(() => {
    if (profile?.username) setUsername(profile.username);
  }, [profile]);

  // Se não estiver logado, manda pro login - MAS SÓ DEPOIS DE TERMINAR O LOADING
  useEffect(() => {
    if (!authLoading && !user) {
        // Delay maior para dar tempo do AuthContext processar o token do magic link
        const timer = setTimeout(() => {
            if (!user) navigate('/login');
        }, 3000);
        return () => clearTimeout(timer);
    }
  }, [user, authLoading, navigate]);

    const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarBlob) return null;
    
    try {
        // Validar tamanho (max 5MB)
        if (avatarBlob.size > 5 * 1024 * 1024) {
            setErrorMsg('A imagem deve ter no máximo 5MB.');
            return null;
        }

        // Validar tipo
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!validTypes.includes(avatarBlob.type)) {
            setErrorMsg('Formato inválido. Use JPG, PNG ou WebP.');
            return null;
        }

        // Gerar path estruturado: avatars/{auth_user_id}/{timestamp}.webp
        const timestamp = Date.now();
        const filePath = `${userId}/${timestamp}.webp`;
        
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, avatarBlob, { 
                contentType: 'image/webp',
                cacheControl: '3600',
                upsert: false // Evita sobrescrever
            });

        if (uploadError) throw uploadError;

        // Salva o PATH; a renderização usa signed URL
        return filePath;
    } catch (err: any) {
        console.error("Erro upload avatar:", err);
        setErrorMsg(err.message || 'Erro ao fazer upload da foto.');
        return null;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!username.trim()) {
        setErrorMsg("Você precisa de um apelido.");
        return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
        let avatarUrl = profile?.avatar_url;

        // 1. Upload Avatar se houver nova imagem
        if (avatarBlob) {
            const path = await uploadAvatar(user.id);
            if (path) {
                avatarUrl = path;
            } else {
                // Se falhou o upload, pára aqui
                setLoading(false);
                return;
            }
        }

        // 2. Validar username único (se diferente do atual)
        if (!profile || username.trim().toLowerCase() !== profile.username?.toLowerCase()) {
            const { data: existingUsername } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', username.trim())
                .neq('auth_id', user.id)
                .single();
            
            if (existingUsername) {
                setErrorMsg('Este apelido já está em uso. Escolha outro.');
                setLoading(false);
                return;
            }
        }

        // 3. Verifica se o perfil já existe
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, auth_id')
            .eq('auth_id', user.id)
            .single();

        if (existingProfile) {
            // Perfil existe - faz UPDATE
            const { error } = await supabase
                .from('profiles')
                .update({
                    username: username.trim(),
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('auth_id', user.id);

            if (error) {
                // Verifica se é erro de username duplicado
                if (error.code === '23505') {
                    setErrorMsg('Este apelido já está em uso. Escolha outro.');
                    setLoading(false);
                    return;
                }
                throw error;
            }
        } else {
            // Perfil não existe - faz INSERT
            const { error } = await supabase
                .from('profiles')
                .insert({
                    auth_id: user.id,
                    username: username.trim(),
                    avatar_url: avatarUrl,
                });

            if (error) {
                // Verifica se é erro de username duplicado
                if (error.code === '23505') {
                    setErrorMsg('Este apelido já está em uso. Escolha outro.');
                    setLoading(false);
                    return;
                }
                throw error;
            }
        }

        // Sucesso
        navigate('/hub');

    } catch (error: any) {
        console.error("Erro ao salvar perfil:", error);
        setErrorMsg(error.message || "Erro ao salvar perfil.");
    } finally {
        setLoading(false);
    }
  };

  // Mostra tela de loading enquanto autentica
  if (authLoading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-black">
        <div className="text-center animate-pulse">
          <h2 className="text-xl font-display font-bold mb-2 text-white">CARREGANDO</h2>
          <p className="font-serif italic text-neutral-500">Preparando sua identidade...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex items-center justify-center p-6 pt-24 relative">
      <div className="w-full max-w-md bg-black border border-neutral-800 p-8 md:p-12 relative z-10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-8 text-center">
            <h2 className="text-3xl font-display font-bold mb-2 uppercase">Identidade</h2>
            <p className="font-serif italic text-neutral-500">
                {profile?.username ? 'Modifique sua identidade, se desejar.' : 'Quem você será no fim do mundo?'}
            </p>
        </div>

        {errorMsg && (
            <div className="mb-6 p-3 border border-violet-700 bg-violet-700/10 text-violet-700 text-xs text-center uppercase">
                {errorMsg}
            </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col items-center space-y-6">
            <AvatarEditor onSave={setAvatarBlob} />

            <div className="w-full">
                <Input 
                    label="Apelido" 
                    placeholder="Ex: JuizDoApocalipse" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="text-center"
                />
            </div>

            <Button fullWidth type="submit" disabled={loading}>
                {loading ? 'Salvando...' : (profile?.username ? 'Atualizar Perfil' : 'Confirmar Identidade')}
            </Button>

            {profile?.username && (
                <button
                    type="button"
                    onClick={() => navigate('/hub')}
                    className="w-full text-center text-sm font-serif text-neutral-400 hover:text-white transition-colors underline"
                >
                    Manter perfil atual e continuar
                </button>
            )}
        </form>
      </div>
    </div>
  );
};

export default SetupProfile;