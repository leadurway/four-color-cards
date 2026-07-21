import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// iOS Safari doesn't reliably resolve 100% / 100vh / 100dvh against the
// actual visible viewport (toolbar show/hide, standalone home-screen mode,
// etc). Drive the real height from window.visualViewport / innerHeight and
// expose it as a CSS custom property that the layout consumes instead.
function setAppHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${h}px`);
}
setAppHeight();
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', setAppHeight);
window.visualViewport?.addEventListener('resize', setAppHeight);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
