import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Ant Design v5 uses CSS-in-JS (no manual CSS import needed),
// but we reset the body margin to prevent layout issues.
const style = document.createElement('style');
style.textContent = `
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  #root {
    height: 100vh;
  }
  
  /* Global Page Container Sizing */
  .formai-page-container {
    padding: 20px 24px 24px;
  }
  
  /* Responsive Overrides for Mobile Viewports */
  @media (max-width: 768px) {
    .formai-page-container {
      padding: 12px 12px 16px !important;
    }
    .ant-card {
      border-radius: 8px !important;
    }
    .ant-card-body {
      padding: 12px !important;
    }
    .ant-card-head {
      padding: 0 12px !important;
      min-height: 40px !important;
    }
    .ant-card-head-title {
      padding: 10px 0 !important;
    }
    /* Let tables scale nicely and scroll sideways on overflow */
    .ant-table-wrapper {
      width: 100% !important;
      overflow-x: auto !important;
    }
    .ant-table {
      font-size: 13px !important;
    }
  }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
