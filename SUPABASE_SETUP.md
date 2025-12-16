# 🔐 Configuração de Segurança no Supabase

## Problema: "new row violates row-level security policy"

Este erro ocorre porque o Supabase tem **Row Level Security (RLS)** ativado, mas as políticas não estão configuradas corretamente.

## ✅ Solução Rápida

### Passo 1: Acessar o Supabase Dashboard

1. Acesse: https://app.supabase.com/
2. Selecione seu projeto: **yjhlvvmsuqcmtakgkgev**
3. Vá em **SQL Editor** (ícone de </> no menu lateral)

### Passo 2: Executar o Script SQL

1. Abra o arquivo `supabase-rls-policies.sql` neste projeto
2. Copie **TODO** o conteúdo do arquivo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** (ou Ctrl+Enter)

### Passo 3: Criar o Bucket de Avatares (se não existir)

1. No Supabase Dashboard, vá em **Storage** (menu lateral)
2. Se o bucket `avatars` não existir:
   - Clique em **New bucket**
   - Name: `avatars`
   - Public: **false** (deixe desmarcado)
   - Clique em **Create bucket**

3. Depois de criar, clique no bucket `avatars`
4. Vá na aba **Policies**
5. As políticas de storage devem ser criadas automaticamente pelo script SQL

### Passo 4: Verificar a Configuração

Execute este comando no SQL Editor para verificar:

```sql
-- Verificar políticas da tabela profiles
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'profiles';

-- Verificar políticas do storage
SELECT *
FROM storage.policies
WHERE bucket_id = 'avatars';
```

## 📋 O que as Políticas Fazem

### Tabela `profiles`:

- ✅ **SELECT**: Qualquer usuário autenticado pode VER todos os perfis
- ✅ **INSERT**: Usuários podem CRIAR apenas seu próprio perfil
- ✅ **UPDATE**: Usuários podem ATUALIZAR apenas seu próprio perfil
- ✅ **DELETE**: Usuários podem DELETAR apenas seu próprio perfil

### Storage `avatars`:

- ✅ **SELECT**: Qualquer pessoa pode VER avatares (público)
- ✅ **INSERT**: Usuários podem FAZER UPLOAD apenas em sua própria pasta
- ✅ **UPDATE**: Usuários podem ATUALIZAR apenas seus próprios avatares
- ✅ **DELETE**: Usuários podem DELETAR apenas seus próprios avatares

## 🔍 Como Funciona a Segurança

As políticas usam `auth.uid()` que retorna o ID do usuário autenticado automaticamente a partir do token JWT.

```sql
-- Exemplo: Só permite update se o auth_id for igual ao usuário logado
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id)
```

## 🚨 Importante

1. **Nunca desative o RLS** - isso deixaria seu banco de dados vulnerável
2. **Sempre use `auth_id`** para vincular registros ao usuário
3. **O token JWT** já contém as permissões necessárias após executar as políticas

## 🛠️ Troubleshooting

### Erro: "relation 'profiles' does not exist"
- Você precisa criar a tabela `profiles` primeiro

### Erro: "column 'auth_id' does not exist"
- A tabela `profiles` precisa ter uma coluna `auth_id` do tipo UUID

### Avatares não aparecem
- Verifique se o bucket `avatars` está criado
- Verifique se as políticas de storage foram aplicadas
- Tente acessar a URL do avatar diretamente no navegador

### Estrutura Esperada da Tabela `profiles`

```sql
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## ✨ Pronto!

Após executar o script SQL, você deve conseguir:
- ✅ Atualizar seu perfil
- ✅ Fazer upload de avatar
- ✅ Alterar seu username
- ✅ Trocar sua senha

Se continuar com problemas, verifique o console do navegador (F12) para ver mensagens de erro detalhadas.
