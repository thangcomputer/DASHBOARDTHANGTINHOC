import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import './index.css';
import './styles/darkMode.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { initTelemetry } from './utils/telemetry';

initTelemetry();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SWRConfig value={{
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: false,
      dedupingInterval: 30_000,
      focusThrottleInterval: 60_000,
    }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SWRConfig>
  </StrictMode>,
);
