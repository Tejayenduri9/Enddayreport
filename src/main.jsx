import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { restaurantTheme } from './restaurantConfig.js'
import { applyThemeToDom } from './themeUtils.js'

applyThemeToDom(restaurantTheme)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)