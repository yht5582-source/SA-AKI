import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { BrowserRouter } from 'react-router-dom';
import { ApplicationRoutes } from './app/routes';
import { registerServiceWorker } from './serviceWorkerRegistration';
import '@fontsource-variable/noto-sans-tc';
import './styles/tokens.css';
import './styles/global.css';

registerServiceWorker(registerSW);
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter basename="/SA-AKI"><ApplicationRoutes /></BrowserRouter></StrictMode>);
