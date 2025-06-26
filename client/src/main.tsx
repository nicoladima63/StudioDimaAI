import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@coreui/coreui/dist/css/coreui.min.css'
import App from '@/App'

// Get the root element
const rootElement = document.getElementById('root')

// React 19's more resilient approach
try {
  if (!rootElement) {
    throw new Error(
      'Root element not found. Please add <div id="root"></div> to your HTML.'
    )
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
} catch (error) {
  console.error('Failed to mount React application:', error)
  
  // Fallback UI for production
  if (process.env.NODE_ENV === 'production') {
    document.body.innerHTML = `
      <div style="
        color: red; 
        padding: 2rem; 
        font-family: sans-serif;
        max-width: 800px;
        margin: 0 auto;
      ">
        <h1>Application Error</h1>
        <p>Failed to initialize the application.</p>
        <p>Please refresh the page or contact support if the problem persists.</p>
        <details style="margin-top: 1rem; color: #666;">
          <summary>Technical details</summary>
          <pre style="overflow-x: auto;">${error instanceof Error ? error.message : String(error)}</pre>
        </details>
      </div>
    `
  }
}
