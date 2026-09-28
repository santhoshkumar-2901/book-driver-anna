import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './utils/themeContext'
import { PricingProvider } from './context/PricingContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <PricingProvider>
        <App />
      </PricingProvider>
    </ThemeProvider>
  </React.StrictMode>,
)

