import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { SiteAccess } from '../../components/SiteAccess';
import '../../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="min-h-screen bg-panel px-8 py-6 text-ink">
      <SiteAccess />
    </main>
  </StrictMode>,
);
