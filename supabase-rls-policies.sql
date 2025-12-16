-- ============================================================================
-- POLÍTICAS DE SEGURANÇA (RLS) PARA O SUPABASE
-- ============================================================================
-- Execute estes comandos no SQL Editor do Supabase para configurar as 
-- permissões corretas nas tabelas
-- ============================================================================

-- 1. TABELA: profiles
-- Permite que usuários vejam e atualizem seus próprios perfis

-- Habilita RLS na tabela profiles (se ainda não estiver habilitado)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas (se existirem)
DROP POLICY IF EXISTS "Usuários podem ver todos os perfis" ON profiles;
DROP POLICY IF EXISTS "Usuários podem inserir seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuários podem deletar seu próprio perfil" ON profiles;

-- Política para SELECT: usuários podem ver todos os perfis
CREATE POLICY "Usuários podem ver todos os perfis"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Política para INSERT: usuários podem criar apenas seu próprio perfil
CREATE POLICY "Usuários podem inserir seu próprio perfil"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_id);

-- Política para UPDATE: usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- Política para DELETE: usuários podem deletar apenas seu próprio perfil (opcional)
CREATE POLICY "Usuários podem deletar seu próprio perfil"
ON profiles FOR DELETE
TO authenticated
USING (auth.uid() = auth_id);

-- ============================================================================

-- 2. BUCKET: avatars (Storage)
-- Permite upload e download de avatares

-- No Supabase Dashboard, vá em Storage > avatars > Policies e adicione:

-- Política para SELECT (visualização pública de avatares):
-- Nome: "Avatar images are publicly accessible"
-- Allowed operations: SELECT
-- Policy definition:
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Política para INSERT (upload de avatares):
-- Nome: "Users can upload their own avatar"
-- Allowed operations: INSERT
-- Policy definition:
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para UPDATE (atualizar avatares):
-- Nome: "Users can update their own avatar"
-- Allowed operations: UPDATE
-- Policy definition:
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para DELETE (deletar avatares antigos):
-- Nome: "Users can delete their own avatar"
-- Allowed operations: DELETE
-- Policy definition:
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================

-- 3. TABELA: games (se você tiver uma tabela de jogos)
-- Permite que usuários vejam jogos que participam e criem novos jogos

-- Habilita RLS na tabela games
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: usuários podem ver jogos onde são participantes
CREATE POLICY "Usuários podem ver jogos onde participam"
ON games FOR SELECT
TO authenticated
USING (
  auth.uid() = ANY(players) 
  OR auth.uid() = host_id
  OR status = 'waiting' -- Permite ver jogos em espera para entrar
);

-- Política para INSERT: usuários podem criar jogos
CREATE POLICY "Usuários podem criar jogos"
ON games FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = host_id);

-- Política para UPDATE: host pode atualizar o jogo
CREATE POLICY "Host pode atualizar o jogo"
ON games FOR UPDATE
TO authenticated
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Para verificar se as políticas foram criadas corretamente:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('profiles', 'games')
ORDER BY tablename, policyname;

-- Para verificar políticas de storage:
SELECT *
FROM storage.policies
WHERE bucket_id = 'avatars';

-- ============================================================================
-- IMPORTANTE
-- ============================================================================
-- 1. Certifique-se de que a coluna 'auth_id' na tabela 'profiles' está 
--    corretamente vinculada ao auth.uid() do usuário
-- 
-- 2. A tabela 'profiles' deve ter uma constraint UNIQUE em 'auth_id'
--
-- 3. Execute este comando para garantir a constraint:
ALTER TABLE profiles 
ADD CONSTRAINT profiles_auth_id_unique 
UNIQUE (auth_id);

-- 4. Se o bucket 'avatars' não existir, crie-o no Supabase Dashboard:
--    Storage > New bucket > Name: avatars, Public: false
--
-- ============================================================================
