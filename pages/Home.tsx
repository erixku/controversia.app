import React, { useEffect, useRef } from 'react';
import animeBase from 'animejs';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth(); // Hooks de autenticação

  // Lógica de Redirecionamento Inteligente
  useEffect(() => {
    // Se o AuthContext terminou de carregar e existe um usuário logado
    if (!loading && user) {
        // Se já tem username, vai pro jogo. Se não (veio do email), vai configurar perfil.
        if (profile?.username) {
            navigate('/hub');
        } else {
            navigate('/setup-profile');
        }
    }
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    // Robust animejs import handling
    const anime = (animeBase as any).default || animeBase;

    // Verificações de segurança
    if (!titleRef.current || !subtitleRef.current || !buttonsRef.current || !cardContainerRef.current) {
      return;
    }

    if (!anime || typeof anime.timeline !== 'function') {
      return;
    }

    // Text Reveal Animation
    const timeline = anime.timeline({
      easing: 'easeOutExpo',
    })
    .add({
      targets: titleRef.current,
      opacity: [0, 1],
      translateY: [50, 0],
      duration: 1500,
      delay: 300
    })
    .add({
      targets: subtitleRef.current,
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 1200,
      offset: '-=1000'
    })
    .add({
      targets: Array.from(buttonsRef.current.children), 
      opacity: [0, 1],
      translateY: [20, 0],
      delay: anime.stagger(200),
      duration: 1000,
      offset: '-=800'
    });

    // Background Cards
    const container = cardContainerRef.current;
    const words = ["ABSURDO", "CAOS", "LÓGICA", "MEDO", "RISO", "TABU", "FOGO", "EGO", "VAZIO"];
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < 15; i++) {
        const card = document.createElement('div');
        const isBlack = Math.random() > 0.5;
        card.classList.add(
            'absolute', 
            'w-32', 'h-48', 
            'border', 
            isBlack ? 'bg-black' : 'bg-white',
            isBlack ? 'border-neutral-800' : 'border-black',
            isBlack ? 'text-white' : 'text-black',
            'p-4', 'flex', 'items-start', 'justify-start',
            'font-display', 'font-bold', 'text-xl', 'opacity-20', 'select-none'
        );
        card.innerText = words[Math.floor(Math.random() * words.length)];
        card.style.top = `${Math.random() * 100}%`;
        card.style.left = `${Math.random() * 100}%`;
        card.style.transform = `rotate(${Math.random() * 360}deg)`;
        fragment.appendChild(card);
    }
    
    if (container) {
       container.appendChild(fragment);
    }

    // Animation loop for cards
    const cardElements = container ? Array.from(container.children) : [];
    let cardsAnimation: any = null;
    
    if (cardElements.length > 0) {
        cardsAnimation = anime({
            targets: cardElements,
            translateY: () => anime.random(-100, 100),
            translateX: () => anime.random(-100, 100),
            rotate: () => anime.random(-45, 45),
            opacity: [0.1, 0.3],
            duration: () => anime.random(5000, 10000),
            direction: 'alternate',
            loop: true,
            easing: 'easeInOutSine'
        });
    }

    return () => {
        if (timeline) timeline.pause();
        if (cardsAnimation) cardsAnimation.pause();
        if (container) container.innerHTML = '';
    };

  }, []);

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-80px)] flex flex-col items-center justify-center overflow-hidden p-6 pt-20">
      <div ref={cardContainerRef} className="absolute inset-0 z-0 pointer-events-none opacity-40 overflow-hidden" />
      <div className="z-10 text-center max-w-4xl mx-auto flex flex-col items-center">
        <h1 
            ref={titleRef} 
            className="text-6xl md:text-9xl font-display font-bold uppercase tracking-tighter mb-6 leading-none mix-blend-difference opacity-0"
        >
          Contro<br/>versia
        </h1>
        <p 
            ref={subtitleRef} 
            className="text-xl md:text-3xl font-serif italic text-neutral-400 mb-12 max-w-2xl opacity-0"
        >
          O jogo de cartas onde a moralidade é opcional e o humor negro é mandatório.
        </p>
        <div ref={buttonsRef} className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-6 opacity-0">
          <Button onClick={() => navigate('/login')} className="md:px-12 md:py-4 md:text-lg">
            Iniciar Partida
          </Button>
          <Button variant="outline" onClick={() => navigate('/sobre')} className="md:px-12 md:py-4 md:text-lg">
            Entender o Conceito
          </Button>
        </div>
      </div>
      <div className="absolute bottom-10 right-10 hidden md:block">
        <span className="font-display text-xs tracking-widest text-neutral-600">
            v1.0.0 [BETA]
        </span>
      </div>
    </div>
  );
};

export default Home;