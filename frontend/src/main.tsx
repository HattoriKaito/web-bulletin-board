import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW登録失敗はアプリの動作に致命的ではないため無視する
      })
    })
  } else {
    // 開発サーバーではService Workerを登録しないが、過去に同じポートで
    // `vite preview`（本番ビルド）を動かしたことがあると、その時登録された
    // Service Workerがブラウザに残り続け、devサーバーへのアクセスに
    // 干渉することがある（実際にこの問題が発生したため対策として追加）。
    // 開発モードで起動するたびに、そのoriginに残った登録を必ず解除しておく。
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
  }
}
