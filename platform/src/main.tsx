import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient as LegacyQueryClient, QueryClientProvider as LegacyQueryClientProvider } from 'react-query'
import { QueryClient as TanstackQueryClient, QueryClientProvider as TanstackQueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import { LanguageProvider } from '@/contexts/LanguageContext'
import './index.css'

const defaultQueryOptions = {
  queries: {
    retry: 1,
    refetchOnWindowFocus: false,
  },
}

const legacyQueryClient = new LegacyQueryClient({ defaultOptions: defaultQueryOptions })
const tanstackQueryClient = new TanstackQueryClient({ defaultOptions: defaultQueryOptions })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LegacyQueryClientProvider client={legacyQueryClient}>
      <TanstackQueryClientProvider client={tanstackQueryClient}>
        <LanguageProvider>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <App />
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
          </BrowserRouter>
        </LanguageProvider>
      </TanstackQueryClientProvider>
    </LegacyQueryClientProvider>
  </React.StrictMode>,
)
