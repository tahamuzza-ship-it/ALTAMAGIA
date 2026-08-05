import { createRoot } from 'react-dom/client';

// El motor 3D (react-three-fiber) a veces intenta conectar sus eventos justo
// cuando el canvas ya se desmontó (al cambiar rápido de pestaña o al perder
// el contexto WebGL). Ese error es inofensivo pero tumba toda la app si no
// se atrapa aquí. La vista 3D simplemente se vuelve a montar.
window.addEventListener('error', (e) => {
  if (e.message?.includes("reading 'addEventListener'")) {
    e.preventDefault();
  }
});

import App from './App';

import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
