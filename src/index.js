import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 本番ビルドで index.css がないことによるエラーを防ぐため、インポートを削除またはコメントアウトします
// import './index.css'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);
