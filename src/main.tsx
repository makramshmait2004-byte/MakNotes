import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { initAuth } from './stores/auth';
import { setLang, useLang } from './i18n';
import './index.css';

// Apply cached theme/language before first paint to avoid a flash.
try {
  const cached = JSON.parse(localStorage.getItem('maknotes-settings') || '{}');
  const dark = cached.theme !== 'light' && !(cached.theme === 'system' && !matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
} catch {
  document.documentElement.classList.add('dark');
}
setLang(useLang.getState().lang);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, networkMode: 'offlineFirst' } },
});

void initAuth();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
