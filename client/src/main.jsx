import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import './index.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SWRConfig value={{
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      dedupingInterval: 30_000,
    }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SWRConfig>
  </StrictMode>,
);
