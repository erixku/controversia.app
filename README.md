<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Controvérsia

Aplicação React + Vite + Supabase.

## Rodar localmente

**Pré-requisitos:** Node.js (LTS)

1. Instalar dependências:
   `npm install`
2. Criar `.env.local` baseado em [.env.example](.env.example) e preencher:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Rodar em dev:
   `npm run dev`

## Setup do gameplay (Supabase)

1. No Supabase SQL Editor, execute o script em [supabase/gameplay.sql](supabase/gameplay.sql).
2. Em Database → Replication (Realtime), habilite Realtime para as tabelas:
   - `game_rounds`
   - `game_hands`
   - `game_submissions`
   - `game_submission_cards`

## Deploy no Vercel

1. Suba o repositório (GitHub/GitLab/Bitbucket).
2. No Vercel, clique em **Add New → Project** e importe o repo.
3. Configure:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Em **Project Settings → Environment Variables**, crie:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (opcional) `VITE_GEMINI_API_KEY`
5. Deploy.

Observação: o app usa `HashRouter`, então não precisa configurar rewrites para rotas SPA.
