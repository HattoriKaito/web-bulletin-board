# BoatAI フロントエンド

React + TypeScript + Vite。PWA対応のためService Workerを使用している（`public/sw.js`、本番ビルドでのみ登録：`src/main.tsx`参照）。

## 開発時の注意：Service Workerとポートの混同

`npm run dev`（開発サーバー）では意図的にService Workerを登録していないが、
**同じポート（既定では5173）で一度でも本番ビルド（`vite preview`等）を動かしたことがあると、
その時登録されたService Workerがブラウザに残り、以降その`localhost:5173`への
アクセス全般に干渉し続ける**（devサーバーを見ているつもりでも古いキャッシュ経由の
挙動になり、ログインできない等の分かりにくい不具合として現れることがある。実際に発生した）。

**予防策**：

- PWA/本番ビルドの動作確認で `vite preview` を使う際は、開発サーバーとは別のポートを使う
  （`vite preview` の既定ポートは4173で、5173とは別なので、`--port 5173` のように
  明示的に上書きしない限り衝突しない。CORSの検証等でバックエンドの`FRONTEND_ORIGIN`と
  一致させる必要がある場合は、その確認作業の間だけ`FRONTEND_ORIGIN`側を
  一時的にpreviewのポートに合わせる方が安全）。
- 保険として、`src/main.tsx`は開発モード起動時に毎回
  `navigator.serviceWorker.getRegistrations()`でそのoriginに残っている登録を
  すべて解除するようにしている。そのため通常はブラウザを再読み込みするだけで
  解消するはずだが、解消しない場合は下記の手動クリア手順を行う。

## 古いService Worker / キャッシュの手動クリア手順

上記の予防策を入れる前に発生した混乱など、ブラウザに残った古い状態を
手動で消したい場合：

1. 対象のページ（例：`http://localhost:5173`）を開いた状態でDevTools（F12）を開く
2. 「Application」タブ → 左メニューの「Service Workers」を開く
3. 一覧に表示されている該当originの登録を探し、「Unregister」をクリック
4. 続けて「Application」タブ → 左メニューの「Storage」→「Clear site data」ボタンを押す
   （Cache Storage・LocalStorage・IndexedDB等をまとめて削除できる）
5. ページを再読み込み（ハードリロード：Ctrl+Shift+R）する

シークレット/プライベートウィンドウはこれらの状態を一切引き継がないため、
問題の切り分け（devサーバー自体の不具合か、ブラウザに残った古い状態が原因か）にも有効。

---

## React + TypeScript + Vite（テンプレート標準の説明）

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
