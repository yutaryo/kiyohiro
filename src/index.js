import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // ここは './App' のままでOK（.js も .jsx も探してくれます）

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
