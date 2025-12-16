import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// O ponto de entrada real agora é gerenciado pelo Next.js.
// Este arquivo existe apenas para compatibilidade com ferramentas legadas.

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}