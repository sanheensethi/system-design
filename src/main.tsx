import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// After a deploy, a browser can still hold the previous page for a few minutes (GitHub Pages caches
// it), and that page points at lesson files the new build replaced. When one fails to download,
// reload once to pick up the current build. The flag stops a reload loop if the failure is real.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('sdim.reloadedForBuild')) return;
    sessionStorage.setItem('sdim.reloadedForBuild', '1');
  } catch {
    return; // without storage we cannot guard against a loop, so let the normal error UI handle it
  }
  event.preventDefault();
  location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
