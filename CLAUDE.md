# CLAUDE.md

## 專案概述

**2026-ai-adv-homework-course01** — 花卉電商網站全端應用

技術棧：Node.js + Express + SQLite (better-sqlite3) + EJS 模板引擎 + Tailwind CSS v4 + Vitest 測試框架。採 SSR（伺服器端渲染）架構，前後端整合於同一 Express 應用。認證使用 JWT（7 天有效期），購物車支援雙模式認證（已登入 JWT + 遊客 Session ID）。

## 常用指令

```bash
# 完整啟動（含 CSS 編譯）
npm start

# 開發模式（需兩個終端分別執行）
npm run dev:server        # 啟動 Express 伺服器（port 3001）
npm run dev:css           # Tailwind CSS 監聽編譯

# 建置 CSS（單次）
npm run css:build

# 執行所有測試
npm test

# 產生 OpenAPI 文件
npm run openapi
```

## 關鍵規則

- **JWT_SECRET 必填**：`server.js` 啟動時若未設定 `JWT_SECRET` 環境變數，程序強制退出（`process.exit(1)`）
- **購物車雙模式認證**：購物車 API 同時接受 `Authorization: Bearer <token>`（已登入）與 `X-Session-Id` header（遊客），兩者不互通，遊客購物車登入後不會自動合併
- **訂單建立為原子交易**：建立訂單 → 建立訂單項（快照商品名稱/價格） → 扣除庫存 → 清空購物車，四步驟在單一 SQLite transaction 中完成；庫存在下單時即扣除，非付款時扣除
- **商品刪除限制**：有 `pending` 狀態訂單的商品無法刪除（返回 409），需訂單完成或取消後才能刪除
- **測試執行順序固定**：`vitest.config.js` 中定義測試檔案序列（auth → products → cart → orders → adminProducts → adminOrders），且禁止平行執行（`fileParallelism: false`）
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`

## 詳細文件

- [./docs/README.md](./docs/README.md) — 項目介紹、快速開始、技術棧、文件索引
- [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流、API 路由總覽、DB Schema
- [./docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則、環境變數、新增模組步驟
- [./docs/FEATURES.md](./docs/FEATURES.md) — 功能清單、完成狀態、行為描述、業務邏輯說明
- [./docs/TESTING.md](./docs/TESTING.md) — 測試規範、測試檔案說明、撰寫新測試指南
- [./docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌
