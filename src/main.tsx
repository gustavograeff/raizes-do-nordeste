import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import { StoreProvider } from './store';
import { App } from './App';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Elemento #root não encontrado no index.html.');
}

// HashRouter porque a publicação é estática (GitHub Pages), sem reescrita de rota no servidor.
createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HashRouter>
  </StrictMode>,
);
