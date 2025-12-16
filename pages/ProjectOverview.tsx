import React from 'react';

const ProjectOverview: React.FC = () => {
  return (
    <div className="flex-grow p-6 pt-28 md:px-20 md:pt-32 max-w-5xl mx-auto w-full">
      <header className="mb-16 border-b border-neutral-800 pb-8">
        <h1 className="text-5xl md:text-7xl font-display font-bold mb-4">ESPECIFICAÇÃO DO PROJETO</h1>
        <p className="text-xl font-serif italic text-neutral-400">
          Entendimento técnico e arquitetural da plataforma "Controversia".
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 font-serif leading-relaxed text-lg text-neutral-300">
        
        <section>
          <h3 className="font-display text-2xl text-white mb-6 uppercase tracking-wider border-l-4 border-white pl-4">
            Objetivo Central
          </h3>
          <p className="mb-4">
            Desenvolver uma aplicação web de jogo de cartas multijogador em tempo real, suportando até 15 jogadores simultâneos por sala. A mecânica se baseia na associação satírica de frases (Cards Against Humanity / F.D.P.), exigindo baixa latência e sincronização de estado perfeita entre clientes.
          </p>
          <p>
            O diferencial reside na estética <strong>minimalista e ousada</strong> (Preto e Branco), focando na tipografia e no contraste para criar uma experiência imersiva e madura.
          </p>
        </section>

        <section>
          <h3 className="font-display text-2xl text-white mb-6 uppercase tracking-wider border-l-4 border-white pl-4">
            Arquitetura Tecnológica
          </h3>
          <ul className="space-y-6">
            <li className="flex flex-col">
              <span className="text-white font-bold mb-1">Frontend (Next.js + TypeScript)</span>
              <span>Utilização de SSR para SEO nas páginas públicas e renderização otimizada. TailwindCSS para estilização "utility-first" garantindo o design system monocromático. Anime.js para micro-interações fluidas (ex: cartas sendo jogadas na mesa).</span>
            </li>
            <li className="flex flex-col">
              <span className="text-white font-bold mb-1">Backend (Nest.js)</span>
              <span>API robusta e modular. O coração do jogo utilizará <strong>WebSockets (Socket.io)</strong> através dos Gateways do Nest.js para gerenciar os eventos de jogo (jogar carta, selecionar vencedor, chat) em tempo real.</span>
            </li>
            <li className="flex flex-col">
              <span className="text-white font-bold mb-1">Dados & Auth (Supabase)</span>
              <span>PostgreSQL para persistência de dados (usuários, decks de cartas, histórico). Autenticação gerida pelo Supabase Auth, integrando login social, e-mail e telefone, com armazenamento seguro de avatares no Supabase Storage.</span>
            </li>
          </ul>
        </section>

        <section className="md:col-span-2 mt-8">
            <h3 className="font-display text-2xl text-white mb-6 uppercase tracking-wider border-l-4 border-white pl-4">
            Funcionalidades de Destaque Planejadas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-neutral-800 p-6 hover:border-white transition-colors duration-300">
                <h4 className="font-display font-bold text-white mb-2">Sistema de Czar</h4>
                <p className="text-sm">Rotação automática do juiz da rodada, garantindo fluidez no gameplay sem necessidade de intervenção manual.</p>
            </div>
            <div className="border border-neutral-800 p-6 hover:border-white transition-colors duration-300">
                <h4 className="font-display font-bold text-white mb-2">Perfil Rico</h4>
                <p className="text-sm">Upload de avatares personalizados, estatísticas de vitórias ("Humilhações Públicas") e biografia curta.</p>
            </div>
            <div className="border border-neutral-800 p-6 hover:border-white transition-colors duration-300">
                <h4 className="font-display font-bold text-white mb-2">Responsividade</h4>
                <p className="text-sm">Interface mobile-first. As cartas devem ser legíveis e interativas mesmo em telas de smartphones.</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default ProjectOverview;