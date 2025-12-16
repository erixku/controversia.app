'use client';

import React, { useEffect, useRef } from 'react';
import animeBase from 'animejs';
import Button from '../components/Button';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
        if (profile?.username) {
            router.push('/hub');
        } else {
            router.push('/setup-profile');
        }
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    const anime = (animeBase as any).default || animeBase;

    if (!titleRef.current || !subtitleRef.current || !buttonsRef.current || !cardContainerRef.current) return;
    
    const timeline = anime.timeline({ easing: 'easeOutExpo' })
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

    const container = cardContainerRef.current;
    const words = ["ABSURDO", "CAOS", "LÓGICA", "MEDO", "RISO", "TABU", "FOGO", "EGO", "VAZIO"];
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < 15; i++) {
        const card = document.createElement('div');
        const isBlack = Math.random() > 0.5;
        card.classList.add(
            'absolute', 'w-32', 'h-48', 'border', 
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
    
    if (container) container.appendChild(fragment);

    return () => {
        if (container) container.innerHTML = '';
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-80px)] flex flex-col items-center justify-center overflow-hidden p-6 pt-20">
      <div ref={cardContainerRef} className="absolute inset-0 z-0 pointer-events-none opacity-40 overflow-hidden" />
      <div className="z-10 text-center max-w-4xl mx-auto flex flex-col items-center">
        <h1 ref={titleRef} className="text-6xl md:text-9xl font-display font-bold uppercase tracking-tighter mb-6 leading-none mix-blend-difference opacity-0">
          Contro<br/>versia
        </h1>
        <p ref={subtitleRef} className="text-xl md:text-3xl font-serif italic text-neutral-400 mb-12 max-w-2xl opacity-0">
          O jogo de cartas onde a moralidade é opcional.
        </p>
        <div ref={buttonsRef} className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-6 opacity-0">
          <Button onClick={() => router.push('/login')} className="md:px-12 md:py-4 md:text-lg">
            Iniciar Partida
          </Button>
          <Button variant="outline" onClick={() => router.push('/sobre')} className="md:px-12 md:py-4 md:text-lg">
            Conceito
          </Button>
        </div>
      </div>
    </div>
  );
}