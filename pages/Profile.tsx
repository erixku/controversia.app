import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import Input from '../components/Input';
import Button from '../components/Button';
import AvatarEditor from '../components/AvatarEditor';
import AvatarImage from '../components/AvatarImage';

const Profile: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Informações do perfil
  const [username, setUsername] = useState('');
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  
  // Troca de senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Estados
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'password' | 'games'>('info');
  const [games, setGames] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username);
    }
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'games' && user) {
      fetchUserGames();
    }
  }, [activeTab, user]);

  const fetchUserGames = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .contains('players', [user.id])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Erro ao buscar jogos:', error);
    }
  };

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
          upsert: false
        });

      if (uploadError) {
        console.error('Erro ao fazer upload:', uploadError);
        throw uploadError;
      }

      // Salva o PATH; a renderização usa signed URL (funciona com bucket privado)
      return filePath;
    } catch (err: any) {
      console.error('Erro upload avatar:', err);
      setErrorMsg(`Erro ao enviar foto: ${err.message}`);
      return null;
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    if (!username.trim()) {
      setErrorMsg('Você precisa de um apelido.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let avatarUrl = profile.avatar_url;

      // Upload avatar se houver nova imagem
      if (avatarBlob) {
        const path = await uploadAvatar(user.id);
        if (path) {
          avatarUrl = path;
        } else {
          // Se falhou o upload, não continua
          setLoading(false);
          return;
        }
      }

      // Atualiza o perfil
      const { error, data } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('auth_id', user.id)
        .select();

      if (error) {
        console.error('Erro do Supabase:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Nenhum perfil foi atualizado. Verifique se seu perfil existe.');
      }

      setSuccessMsg('Perfil atualizado com sucesso!');
      setAvatarBlob(null); // Limpa o blob após salvar
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      setErrorMsg(error.message || 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setSuccessMsg('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      setErrorMsg(error.message || 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-black">
        <div className="text-center animate-pulse">
          <h2 className="text-xl font-display font-bold mb-2 text-white">CARREGANDO</h2>
          <p className="font-serif italic text-neutral-500">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col items-center p-6 pt-28 pb-12 relative">
      <div className="w-full max-w-4xl">
        {/* Header do Perfil */}
        <div className="bg-black border border-neutral-800 p-8 mb-6 text-center">
          <div className="flex flex-col items-center mb-4">
            {profile?.avatar_url && (
              <AvatarImage
                pathOrUrl={profile.avatar_url}
                alt={profile.username}
                className="w-24 h-24 rounded-full border-2 border-white mb-4 object-cover"
              />
            )}
            <h1 className="text-3xl font-display font-bold uppercase">{profile?.username}</h1>
            <p className="font-serif italic text-neutral-400 mt-2">{user?.email}</p>
          </div>
        </div>

        {/* Mensagens */}
        {errorMsg && (
          <div className="mb-6 p-3 border border-violet-700 bg-violet-700/10 text-violet-700 text-xs text-center uppercase animate-pulse">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-3 border border-neutral-600 bg-neutral-800 text-white text-xs text-center uppercase">
            {successMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 mb-6">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-3 font-display uppercase text-sm tracking-wider transition-colors ${
              activeTab === 'info' 
                ? 'border-b-2 border-white text-white' 
                : 'text-neutral-500 hover:text-white'
            }`}
          >
            Informações
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-6 py-3 font-display uppercase text-sm tracking-wider transition-colors ${
              activeTab === 'password' 
                ? 'border-b-2 border-white text-white' 
                : 'text-neutral-500 hover:text-white'
            }`}
          >
            Senha
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className={`px-6 py-3 font-display uppercase text-sm tracking-wider transition-colors ${
              activeTab === 'games' 
                ? 'border-b-2 border-white text-white' 
                : 'text-neutral-500 hover:text-white'
            }`}
          >
            Meus Jogos
          </button>
        </div>

        {/* Conteúdo das Tabs */}
        <div className="bg-black border border-neutral-800 p-8">
          {/* Tab: Informações */}
          {activeTab === 'info' && (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-display font-bold mb-2 uppercase">Editar Perfil</h2>
                <p className="font-serif italic text-neutral-500">Atualize suas informações</p>
              </div>

              <div className="flex flex-col items-center space-y-6">
                <AvatarEditor onSave={setAvatarBlob} />

                <div className="w-full max-w-md">
                  <Input
                    label="Nome de Usuário"
                    placeholder="Ex: JuizDoApocalipse"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <Button fullWidth type="submit" disabled={loading} className="max-w-md">
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          )}

          {/* Tab: Senha */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-6 max-w-md mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-display font-bold mb-2 uppercase">Alterar Senha</h2>
                <p className="font-serif italic text-neutral-500">Defina uma nova senha</p>
              </div>

              <Input
                label="Nova Senha"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />

              <Input
                label="Confirmar Nova Senha"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />

              <Button fullWidth type="submit" disabled={loading}>
                {loading ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </form>
          )}

          {/* Tab: Jogos */}
          {activeTab === 'games' && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-display font-bold mb-2 uppercase">Meus Jogos</h2>
                <p className="font-serif italic text-neutral-500">Histórico de partidas</p>
              </div>

              {games.length === 0 ? (
                <div className="text-center py-12">
                  <p className="font-serif text-neutral-500 text-lg mb-4">
                    Você ainda não participou de nenhum jogo.
                  </p>
                  <Button onClick={() => navigate('/hub')}>
                    Encontrar Jogo
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {games.map((game) => (
                    <div
                      key={game.id}
                      className="border border-neutral-800 p-4 hover:border-neutral-600 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-display font-bold text-lg">Jogo #{game.id.slice(0, 8)}</h3>
                          <p className="font-serif text-sm text-neutral-400">
                            {new Date(game.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`font-display text-sm px-3 py-1 border ${
                            game.status === 'completed' 
                              ? 'border-neutral-600 text-white' 
                              : game.status === 'in_progress'
                              ? 'border-white text-white'
                              : 'border-neutral-800 text-neutral-400'
                          }`}>
                            {game.status === 'completed' ? 'CONCLUÍDO' : 
                             game.status === 'in_progress' ? 'EM ANDAMENTO' : 
                             'AGUARDANDO'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
