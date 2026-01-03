import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // App.js または App.jsx を読み込みます
import './index.css'; // Tailwind CSS などのスタイルシートがある場合

// React 18 の新しいルート作成方法
const root = ReactDOM.createRoot(document.getElementById('root'));

// アプリケーションのレンダリング
// 音楽プレイヤーの二重初期化を防ぐため、StrictMode はオフにしています
root.render(
  <App />
);
