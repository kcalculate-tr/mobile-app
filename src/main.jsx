import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import PwaLifecycle from './components/PwaLifecycle.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PwaLifecycle />
  </StrictMode>,
)
