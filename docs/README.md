# 花卉電商網站 — 專案介紹

## 專案簡介

本專案是一個完整的花卉電商網站，採用 Node.js + Express 全端架構，支援前台購物流程（瀏覽商品、加入購物車、結帳下單）與後台管理功能（商品管理、訂單管理）。

主要特色：
- **SSR 架構**：使用 EJS 模板引擎進行伺服器端渲染，無需獨立前端框架
- **雙模式購物車**：未登入遊客可透過 Session ID 使用購物車，登入後切換為 JWT 認證
- **完整測試覆蓋**：6 個測試檔案涵蓋所有 API 端點
- **原子訂單交易**：訂單建立、庫存扣除、購物車清空在單一 SQLite transaction 中完成

---

## 技術棧

| 類別 | 技術 | 版本 | 說明 |
|------|------|------|------|
| 後端框架 | Express | ~4.16.1 | Web 應用框架 |
| 資料庫 | better-sqlite3 | ^12.8.0 | 同步 SQLite 驅動，支援 WAL 模式 |
| 模板引擎 | EJS | ^5.0.1 | 伺服器端 HTML 渲染 |
| 認證 | jsonwebtoken | ^9.0.2 | JWT 簽發與驗證（HS256，7 天有效） |
| 密碼加密 | bcrypt | ^6.0.0 | bcrypt 雜湊（生產 10 rounds，測試 1 round） |
| CSS 框架 | Tailwind CSS | ^4.2.2 | 原子化 CSS（源 → 編譯輸出） |
| 測試框架 | Vitest | ^2.1.9 | 單元與整合測試 |
| HTTP 測試 | supertest | ^7.2.2 | API 測試用 HTTP 客戶端 |
| API 文件 | swagger-jsdoc | ^6.2.8 | 從 JSDoc 產生 OpenAPI 3.0 文件 |
| UUID 生成 | uuid | ^11.1.0 | 所有主鍵（id）使用 UUID v4 |
| 環境變數 | dotenv | ^16.4.7 | 從 `.env` 載入環境設定 |
| CORS | cors | ^2.8.5 | 跨域資源共享支援 |

---

## 快速開始

### 前置需求

- Node.js 18+ 
- npm 9+

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`，**必填**項目：

```bash
JWT_SECRET=your-super-secret-key-at-least-32-characters
```

其餘項目有預設值，開發時可保留不改。

### 3. 啟動伺服器

```bash
# 完整啟動（自動編譯 Tailwind CSS 後啟動 server）
npm start

# 或開發模式（需兩個終端）
# 終端 1
npm run dev:server

# 終端 2
npm run dev:css
```

### 4. 驗證啟動成功

```bash
# 確認 API 正常
curl http://localhost:3001/api/products
# 應回傳 { "data": { "products": [...] }, "error": null, "message": "成功" }

# 瀏覽器訪問
open http://localhost:3001
```

### 5. 預設管理員帳號

```
Email: admin@hexschool.com
Password: 12345678
```

---

## 常用指令表

| 指令 | 說明 |
|------|------|
| `npm start` | 編譯 CSS 後啟動 server（生產/快速開發用） |
| `npm run dev:server` | 僅啟動 Express server（port 3001） |
| `npm run dev:css` | 監聽 Tailwind CSS 變更並即時編譯 |
| `npm run css:build` | 單次編譯並壓縮 Tailwind CSS |
| `npm test` | 執行所有測試（Vitest，序列執行） |
| `npm run openapi` | 從路由 JSDoc 產生 `openapi.json` |

---

## 專案文件索引

| 文件 | 說明 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | 專案概述、常用指令、關鍵規則（AI 助手用） |
| [docs/ARCHITECTURE.md](./ARCHITECTURE.md) | 架構設計、目錄結構、API 路由總覽、DB Schema、中介軟體 |
| [docs/DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、環境變數說明、新增模組步驟 |
| [docs/FEATURES.md](./FEATURES.md) | 完整功能清單、業務邏輯、錯誤碼說明 |
| [docs/TESTING.md](./TESTING.md) | 測試架構、測試指南、撰寫新測試步驟 |
| [docs/CHANGELOG.md](./CHANGELOG.md) | 版本更新日誌 |
| [docs/plans/](./plans/) | 進行中的功能開發計畫 |
| [docs/plans/archive/](./plans/archive/) | 已完成的開發計畫歸檔 |
