import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/manrope'
import './index.css'
import App from './App'
import { AuthProvider } from '@/context/AuthContext'
import { ProfileProvider } from '@/context/ProfileContext'
import { ToastProvider } from '@/context/ToastContext'
import { InstallProvider } from '@/context/InstallContext'
import { SyncProvider } from '@/context/SyncContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <ToastProvider>
            <InstallProvider>
              <SyncProvider>
                <App />
              </SyncProvider>
            </InstallProvider>
          </ToastProvider>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
