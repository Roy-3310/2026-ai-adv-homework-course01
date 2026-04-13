# 更新日誌 (CHANGELOG.md)

本文件記錄所有重要的版本變更，格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

---

## [1.1.0] — 2026-04-13

### 新增

**ECPay 綠界金流整合**
- `GET /ecpay/checkout/:orderId` — 產生綠界 AIO 付款表單並自動跳轉；JWT 從 query string `?token=` 取得（因瀏覽器直接導向無法帶 header）
- `POST /ecpay/return` — 綠界 ReturnURL 回呼 handler；驗證 CheckMacValue（timing-safe）後更新訂單狀態；即使驗證失敗仍回應 `1|OK` 防止綠界重試
- `POST /api/orders/:id/ecpay-query` — 前端觸發、後端主動向綠界 QueryTradeInfo/V5 查詢交易狀態，確認成功後將訂單 status 更新為 `paid`
- `src/utils/ecpay.js` — ECPay 工具模組：ECPay 專用 URL encode、CheckMacValue 計算/驗證、AIO Form HTML 產生、QueryTradeInfo 查詢
- `orders` 表新增 `ecpay_trade_no TEXT` 欄位（後置 migration，idempotent）

**前端調整**
- `views/pages/order-detail.ejs` — pending 訂單改顯示「前往綠界付款」按鈕（`<a>` 連結）與「確認付款結果」按鈕
- `public/js/pages/order-detail.js` — 移除模擬付款邏輯（`simulatePay`、`handlePaySuccess`、`handlePayFail`），新增 `confirmPayment()` 呼叫 `/api/orders/:id/ecpay-query` 並即時更新畫面

---

## [1.0.0] — 2026-04-13

### 新增

**後端 API**
- `POST /api/auth/register` — 用戶註冊（Email + 密碼 + 姓名），回傳 JWT Token
- `POST /api/auth/login` — 用戶登入，回傳 JWT Token（7 天有效）
- `GET /api/auth/profile` — 取得當前用戶個人資料（需 JWT）
- `GET /api/products` — 商品列表（公開，支援 page/limit 分頁）
- `GET /api/products/:id` — 單一商品詳情（公開）
- `GET /api/cart` — 取得購物車（支援 JWT 或 X-Session-Id 雙模式認證）
- `POST /api/cart` — 加入商品到購物車（已存在則累加數量）
- `PATCH /api/cart/:itemId` — 更新購物車商品數量
- `DELETE /api/cart/:itemId` — 移除購物車商品
- `POST /api/orders` — 從購物車建立訂單（原子交易：建立訂單 + 快照價格 + 扣庫存 + 清購物車）
- `GET /api/orders` — 取得當前用戶訂單列表
- `GET /api/orders/:id` — 取得單一訂單詳情（僅限本人）
- `PATCH /api/orders/:id/pay` — 模擬付款（success/fail 兩種結果）
- `GET /api/admin/products` — 後台商品列表（需 admin 權限）
- `POST /api/admin/products` — 後台新增商品
- `PUT /api/admin/products/:id` — 後台編輯商品
- `DELETE /api/admin/products/:id` — 後台刪除商品（有 pending 訂單則 409）
- `GET /api/admin/orders` — 後台訂單列表（支援 status 篩選）
- `GET /api/admin/orders/:id` — 後台訂單詳情（含訂購人資訊）

**前端頁面**
- `/` — 首頁（商品列表與加入購物車）
- `/products/:id` — 商品詳情頁
- `/cart` — 購物車頁（數量調整、移除商品）
- `/checkout` — 結帳頁（填寫收件資訊、確認送出）
- `/login` — 登入/註冊頁（單頁切換兩種表單）
- `/orders` — 我的訂單列表
- `/orders/:id` — 訂單詳情（含模擬付款按鈕）
- `/admin/products` — 後台商品管理（新增/編輯/刪除）
- `/admin/orders` — 後台訂單管理（依狀態篩選）

**基礎設施**
- SQLite 資料庫（WAL 模式，Foreign Keys 強制啟用）
- JWT 認證系統（HS256，7 天有效期，payload: userId/email/role）
- bcrypt 密碼雜湊（生產 10 rounds，測試 1 round）
- 雙模式購物車認證（JWT 已登入 + X-Session-Id 遊客模式）
- 統一 JSON 回應格式（`data` / `error` / `message`）
- 全域錯誤處理（隱藏 500 細節，統一格式）
- Tailwind CSS v4 整合（input.css → output.css 編譯流程）
- EJS 模板引擎（前台/後台雙佈局）
- Swagger/OpenAPI 3.0 文件（`npm run openapi` 產生）
- Vitest 測試套件（6 個測試檔案，序列執行）
- 8 個花卉商品種子數據
- 管理員帳號種子數據（`admin@hexschool.com`）

**文件**
- `CLAUDE.md` — 專案概述與關鍵規則
- `docs/README.md` — 項目介紹與快速開始
- `docs/ARCHITECTURE.md` — 架構設計文件
- `docs/DEVELOPMENT.md` — 開發規範與指南
- `docs/FEATURES.md` — 功能清單與行為描述
- `docs/TESTING.md` — 測試規範與指南
- `docs/CHANGELOG.md` — 本文件

---

## 更新日誌撰寫指南

每次重要功能開發完成後，在此文件最上方新增版本條目，格式如下：

```markdown
## [版本號] — YYYY-MM-DD

### 新增
- 新功能描述

### 修改
- 變更描述（包含為何變更）

### 修復
- Bug 修復描述

### 移除
- 被移除的功能
```

版本號規則（[語義化版本](https://semver.org/lang/zh-TW/)）：
- **MAJOR**（x.0.0）：不向後兼容的重大變更
- **MINOR**（x.y.0）：向後兼容的新功能
- **PATCH**（x.y.z）：向後兼容的 Bug 修復
