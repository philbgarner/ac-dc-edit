import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DataProvider } from './DataContext'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </StrictMode>
)
