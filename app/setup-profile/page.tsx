'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Input from '../../components/Input';
import Button from '../../components/Button';
import AvatarEditor from '../../components/AvatarEditor';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';

export default function SetupProfile() {
  const { user, profile } = useAuth();
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.username) setUsername(profile.username);
  }, [profile]);

  useEffect(() => {
    if (!user) {
        const timer = setTimeout(() => {
            if (!user) router.push('/login');
        }, 1000);
        return () => clearTimeout(timer);
    }
  }, [user, router]);

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarBlob) return null;
    try {
        const filePath = `${userId}/${Date.now()}.webp`;
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, avatarBlob, { 
              upsert: true,
              contentType: 'image/webp',
              cacheControl: '3600'
            });

        if (uploadError) throw uploadError;
        // Salva o PATH; a renderização usa signed URL
        return filePath;
    } catch (err) {
        console.error("Erro upload avatar:", err);
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
        if (avatarBlob) {
            const url = await uploadAvatar(user.id);
            if (url) avatarUrl = url;
        }

        const updates = {
            id: profile?.id,
            auth_id: user.id,
            username: username.trim(),
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('profiles')
            .upsert(updates, { onConflict: 'auth_id' });

        if (error) throw error;
        router.push('/hub');

    } catch (error: any) {
        console.error("Erro ao salvar perfil:", error);
        setErrorMsg(error.message || "Erro ao salvar perfil.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center p-6 pt-24 relative">
      <div className="w-full max-w-md bg-black border border-neutral-800 p-8 md:p-12 relative z-10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-8 text-center">
            <h2 className="text-3xl font-display font-bold mb-2 uppercase">Identidade</h2>
            <p className="font-serif italic text-neutral-500">Quem você será no fim do mundo?</p>
        </div>

        {errorMsg && (
            <div className="mb-6 p-3 border border-violet-700/30 bg-violet-700/10 text-violet-700 text-xs text-center uppercase">{errorMsg}</div>
        )}

        <form onSubmit={handleSave} className="flex flex-col items-center space-y-6">
            <AvatarEditor onSave={setAvatarBlob} />
            <div className="w-full">
                <Input label="Apelido" placeholder="Ex: JuizDoApocalipse" value={username} onChange={(e) => setUsername(e.target.value)} required className="text-center" />
            </div>
            <Button fullWidth type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Confirmar Identidade'}</Button>
        </form>
      </div>
    </div>
  );
}