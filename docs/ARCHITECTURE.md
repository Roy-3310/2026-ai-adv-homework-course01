# 架構文件 (ARCHITECTURE.md)

## 架構概述

本專案採**全端 SSR（Server-Side Rendering）架構**，前後端整合於單一 Express 應用。

```
瀏覽器
  │
  ├─ 頁面請求（GET /、/cart、/admin/products…）
  │    └─→ Express + EJS 渲染 HTML 回傳
  │
  └─ API 請求（fetch /api/…）
       └─→ Express JSON API → SQLite → JSON 回應
```

**關鍵設計決策**：
- 頁面由 EJS 在伺服器渲染（SSR），資料由前端頁面 JS 透過 `fetch` 呼叫 API 動態載入
- 純靜態資源（CSS/JS）由 Express 的 `express.static()` 直接提供
- SQLite 使用 WAL 模式提升並發效能，`better-sqlite3` 為同步 API（無 callback/Promise）

---

## 目錄結構

```
2026-ai-adv-homework-course01/
│
├── app.js                     # Express 應用核心：middleware 掛載、路由註冊、view engine 設定
├── server.js                  # 伺服器進入點：環境變數驗證、資料庫初始化、監聽 port
├── package.json               # 依賴清單與 npm scripts
├── .env                       # 本地環境變數（不提交 git）
├── .env.example               # 環境變數範例模板
├── swagger-config.js          # Swagger/OpenAPI 3.0 基礎設定
├── generate-openapi.js        # 從路由 JSDoc 產生 openapi.json
├── vitest.config.js           # Vitest 測試設定（執行順序、parallelism 設定）
├── database.sqlite            # SQLite 資料庫檔案（執行時自動建立）
│
├── src/                       # 後端核心程式碼
│   ├── database.js            # 資料庫連線、Schema 建立、種子數據插入、WAL/FK pragma
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT 驗證：解析 Bearer token，設置 req.user
│   │   ├── adminMiddleware.js # 管理員權限：檢查 req.user.role === 'admin'
│   │   ├── errorHandler.js    # 全域錯誤處理（4 參數），隱藏 500 細節
│   │   └── sessionMiddleware.js # 遊客 Session：提取 X-Session-Id header
│   ├── routes/
│   │   ├── authRoutes.js      # /api/auth：register、login、profile
│   │   ├── productRoutes.js   # /api/products：商品列表（分頁）、商品詳情（公開）
│   │   ├── cartRoutes.js      # /api/cart：購物車 CRUD（Dual-Auth）
│   │   ├── orderRoutes.js     # /api/orders：建立訂單、列表、詳情、ECPay 查詢
│   │   ├── ecpayRoutes.js     # /ecpay：AIO 付款表單、ReturnURL 回呼
│   │   ├── adminProductRoutes.js # /api/admin/products：後台商品管理
│   │   ├── adminOrderRoutes.js   # /api/admin/orders：後台訂單查看
│   │   └── pageRoutes.js      # 頁面路由：所有 EJS 頁面渲染
│   └── utils/
│       └── ecpay.js           # ECPay 工具：CheckMacValue 計算/驗證、AIO Form、QueryTradeInfo
│
├── public/                    # 靜態資源（由 express.static 直接提供）
│   ├── css/
│   │   ├── input.css          # Tailwind CSS 源檔
│   │   └── output.css         # 編譯後的 CSS（自動產生）
│   └── js/
│       ├── api.js             # 前端 API 工具：apiFetch()，自動附加 auth headers
│       ├── auth.js            # 前端認證管理：Auth 物件（localStorage 存取）
│       ├── notification.js    # Toast 通知：Notification.show(message, type)
│       ├── header-init.js     # 頁頭初始化：根據登入狀態顯示/隱藏導覽項目
│       └── pages/             # 各頁面專屬 JS
│           ├── index.js           # 首頁：商品列表渲染、加入購物車
│           ├── product-detail.js  # 商品詳情
│           ├── cart.js            # 購物車：列表、數量更新、移除
│           ├── checkout.js        # 結帳：摘要、收件資訊、提交訂單
│           ├── login.js           # 登入/註冊表單
│           ├── orders.js          # 我的訂單列表
│           ├── order-detail.js    # 訂單詳情、模擬付款按鈕
│           ├── admin-products.js  # 後台商品管理
│           └── admin-orders.js    # 後台訂單管理
│
├── views/                     # EJS 模板（伺服器端渲染）
│   ├── layouts/
│   │   ├── front.ejs          # 前台共用佈局
│   │   └── admin.ejs          # 後台共用佈局
│   ├── pages/
│   │   ├── index.ejs、product-detail.ejs、cart.ejs、checkout.ejs
│   │   ├── login.ejs、orders.ejs、order-detail.ejs、404.ejs
│   │   └── admin/products.ejs、admin/orders.ejs
│   └── partials/
│       ├── head.ejs、header.ejs、footer.ejs、notification.ejs
│       └── admin-header.ejs、admin-sidebar.ejs
│
├── tests/                     # 測試檔案（Vitest + supertest）
│   ├── setup.js               # 測試助手：app、request、getAdminToken()、registerUser()
│   ├── auth.test.js、products.test.js、cart.test.js
│   ├── orders.test.js、adminProducts.test.js、adminOrders.test.js
│
└── docs/                      # 專案文件
    ├── README.md、ARCHITECTURE.md、DEVELOPMENT.md
    ├── FEATURES.md、TESTING.md、CHANGELOG.md
    └── plans/archive/
```

---

## 啟動流程

```
npm start / node server.js
  ├─ 1. 載入 .env（dotenv）
  ├─ 2. 驗證 JWT_SECRET → 未設定則 process.exit(1)
  ├─ 3. 初始化資料庫（src/database.js）
  │      ├─ SQLite 連線、WAL 模式、Foreign Keys
  │      ├─ CREATE TABLE IF NOT EXISTS（5 張表）
  │      ├─ 建立管理員帳號（若不存在）
  │      └─ 插入種子商品（若 products 表為空）
  ├─ 4. 初始化 Express app（app.js）
  │      ├─ static、cors、json、urlencoded、sessionMiddleware
  │      ├─ API 路由（/api/*）、頁面路由（/）
  │      ├─ 404 handler
  │      └─ errorHandler（4 參數，必須最後一個）
  └─ 5. app.listen(PORT=3001)
```

---

## Middleware 掛載順序

| 順序 | Middleware | 說明 |
|------|-----------|------|
| 1 | `express.static('public')` | 靜態資源直接回傳 |
| 2 | `cors(origin: FRONTEND_URL)` | 跨域允許來源 |
| 3 | `express.json()` | 解析 JSON body |
| 4 | `express.urlencoded({extended: false})` | 解析 form-urlencoded |
| 5 | `sessionMiddleware` | 提取 X-Session-Id → `req.sessionId` |
| 6 | API 路由（`/api/*`） | 各功能 API |
| 7 | 頁面路由（`/`） | EJS 渲染 |
| 8 | 404 handler | 未匹配路由 |
| 9 | `errorHandler(err, req, res, next)` | **必須最後**，4 參數為 Express 識別標誌 |

### 各 Middleware 行為

**authMiddleware**：取出 `Authorization: Bearer <token>` → `jwt.verify()` → 查 users 表確認用戶存在 → 設置 `req.user = { userId, email, role }` → 失敗時 401。

**adminMiddleware**（需在 authMiddleware 之後）：檢查 `req.user.role === 'admin'` → 否則 403。

**sessionMiddleware**：提取 `req.headers['x-session-id']` 設為 `req.sessionId`（null 若無），不阻擋請求。

---

## API 路由總覽表

### 認證 API

| Method | 路徑 | 認證 | 說明 |
|--------|------|------|------|
| POST | `/api/auth/register` | 無 | 新用戶註冊 |
| POST | `/api/auth/login` | 無 | 用戶登入 |
| GET | `/api/auth/profile` | JWT | 取得當前用戶資料 |

### 商品 API（公開）

| Method | 路徑 | 認證 | 說明 |
|--------|------|------|------|
| GET | `/api/products` | 無 | 商品列表（支援分頁） |
| GET | `/api/products/:id` | 無 | 單一商品詳情 |

### 購物車 API（雙模式認證）

| Method | 路徑 | 認證 | 說明 |
|--------|------|------|------|
| GET | `/api/cart` | JWT 或 Session ID | 取得購物車內容 |
| POST | `/api/cart` | JWT 或 Session ID | 加入商品（已存在則累加） |
| PATCH | `/api/cart/:itemId` | JWT 或 Session ID | 更新商品數量 |
| DELETE | `/api/cart/:itemId` | JWT 或 Session ID | 移除單一商品 |

### 訂單 API

| Method | 路徑 | 認證 | 說明 |
|--------|------|------|------|
| POST | `/api/orders` | JWT | 從購物車建立訂單 |
| GET | `/api/orders` | JWT | 取得當前用戶訂單列表 |
| GET | `/api/orders/:id` | JWT | 取得單一訂單詳情（僅限本人） |
| PATCH | `/api/orders/:id/pay` | JWT | 模擬付款（success/fail） |
| POST | `/api/orders/:id/ecpay-query` | JWT | 向綠界查詢交易狀態 |

### ECPay 金流 API

| Method | 路徑 | 認證 | 說明 |
|--------|------|------|------|
| GET | `/ecpay/checkout/:orderId` | JWT（query `?token=`） | 產生 AIO 付款表單跳轉綠界 |
| POST | `/ecpay/return` | 無（CheckMacValue 驗證） | 綠界 ReturnURL 回呼 |

### 後台商品 API

| Method | 路徑 | 認證 | 說明 |
|--------|------|------|------|
| GET | `/api/admin/products` | JWT + admin | 後台商品列表（分頁） |
| POST | `/api/admin/products` | JWT + admin | 新增商品 |
| PUT | `/api/admin/products/:id` | JWT + admin | 編輯商品 |
| DELETE | `/api/admin/products/:id` | JWT + admin | 刪除商品（有 pending 訂單則 409） |

### 後台訂單 API

| Method | 路徑 | 認證 | 說明 |
|--------|------|------|------|
| GET | `/api/admin/orders` | JWT + admin | 訂單列表（分頁，可依狀態篩選） |
| GET | `/api/admin/orders/:id` | JWT + admin | 訂單詳情（含訂購人資訊） |

### 頁面路由

| 路徑 | 說明 |
|------|------|
| `/`、`/products/:id` | 首頁、商品詳情 |
| `/cart`、`/checkout` | 購物車、結帳 |
| `/login`、`/orders`、`/orders/:id` | 登入、訂單列表/詳情 |
| `/admin/products`、`/admin/orders` | 後台商品/訂單管理 |

---

## 統一回應格式

```json
{ "data": null, "error": null, "message": "成功" }
```

- `data`：成功時包含業務數據，失敗時為 `null`
- `error`：成功時為 `null`，失敗時為錯誤碼字串
- `message`：人類可讀中文說明

### 常見錯誤碼

| HTTP | error | 說明 |
|------|-------|------|
| 400 | `VALIDATION_ERROR` | 請求參數驗證失敗 |
| 400 | `CART_EMPTY` | 購物車為空 |
| 400 | `STOCK_INSUFFICIENT` | 庫存不足 |
| 401 | `UNAUTHORIZED` | Token 未提供或無效 |
| 403 | `FORBIDDEN` | 無管理員權限 |
| 404 | `NOT_FOUND` | 資源不存在 |
| 409 | `CONFLICT` | Email 重複或商品有未完成訂單 |
| 500 | `INTERNAL_ERROR` | 伺服器內部錯誤 |

---

## 認證與授權機制

### JWT 設定

| 參數 | 值 |
|------|-----|
| 演算法 | HS256 |
| 有效期 | 7 天（`expiresIn: '7d'`） |
| Payload | `userId`、`email`、`role` |
| 密鑰來源 | `process.env.JWT_SECRET` |
| 無效處理 | 401 + 前端清除 localStorage + 重定向 `/login` |

### 前端 Token 儲存（localStorage）

| Key | 內容 |
|-----|------|
| `flower_token` | JWT Token 字串 |
| `flower_user` | 用戶資訊 JSON（id, email, name, role） |
| `flower_session_id` | 遊客 Session UUID（`crypto.randomUUID()` 產生） |

---

## 資料庫 Schema

### 連線設定

```javascript
const db = new Database('database.sqlite');
db.pragma('journal_mode = WAL');   // WAL 模式提升並發讀寫效能
db.pragma('foreign_keys = ON');    // 強制外鍵約束（SQLite 預設關閉）
```

> WAL 模式會產生 `database.sqlite-shm` 和 `database.sqlite-wal`，勿強制刪除。

### users 表

```sql
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,                            -- UUID v4
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                              -- bcrypt（rounds: 10 prod / 1 test）
  name         TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'user'
               CHECK(role IN ('user', 'admin')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### products 表

```sql
CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  price        INTEGER NOT NULL CHECK(price > 0),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  image_url    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### cart_items 表

```sql
CREATE TABLE IF NOT EXISTS cart_items (
  id          TEXT PRIMARY KEY,
  session_id  TEXT,                    -- 遊客識別（X-Session-Id 值）
  user_id     TEXT,                    -- 登入用戶（外鍵 users.id）
  product_id  TEXT NOT NULL,           -- 外鍵 products.id
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

> `session_id` 與 `user_id` 擇一使用，遊客用 `session_id`，登入用 `user_id`。

### orders 表

```sql
CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY,
  order_no          TEXT UNIQUE NOT NULL,  -- 格式：ORD-YYYYMMDD-XXXXX
  user_id           TEXT NOT NULL,
  recipient_name    TEXT NOT NULL,
  recipient_email   TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  total_amount      INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'paid', 'failed')),
  ecpay_trade_no    TEXT,              -- 20 字元英數，首次發起付款時產生
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

> `ecpay_trade_no` 為後置 migration（`ALTER TABLE ADD COLUMN`，idempotent）。

### order_items 表

```sql
CREATE TABLE IF NOT EXISTS order_items (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL,
  product_id    TEXT NOT NULL,
  product_name  TEXT NOT NULL,    -- 下單時名稱快照（商品改名不影響訂單）
  product_price INTEGER NOT NULL, -- 下單時價格快照（商品改價不影響訂單）
  quantity      INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

---

## 購物流程

```
GET /api/products → GET /api/products/:id
  → POST /api/cart（遊客: X-Session-Id / 登入: JWT）
  → POST /api/orders（需 JWT）
      Transaction: INSERT orders → INSERT order_items（快照）
                   → UPDATE stock → DELETE cart_items
  → GET /ecpay/checkout/:id?token=...
      → 產生 AIO Form → 跳轉綠界
  → POST /api/orders/:id/ecpay-query（付款後主動確認）
      → QueryTradeInfo → status: paid
```

---

## 種子數據

### 管理員帳號（每次啟動若不存在則建立）

| 欄位 | 預設值（可由環境變數覆寫） |
|------|------------------------|
| email | `admin@hexschool.com`（`ADMIN_EMAIL`） |
| password | `12345678`（`ADMIN_PASSWORD`） |
| role | admin |

### 商品種子（8 個花卉商品，`products` 表為空時插入）

| 商品名稱 | 價格 | 庫存 |
|---------|------|------|
| 粉色玫瑰花束 | 1,680 | 30 |
| 白色百合花禮盒 | 1,280 | 25 |
| 繽紛向日葵花束 | 980 | 40 |
| 紫色鬱金香盆栽 | 750 | 50 |
| 乾燥花藝術花圈 | 1,450 | 20 |
| 迷你多肉組合盆 | 580 | 60 |
| 經典紅玫瑰花束（99朵） | 3,980 | 15 |
| 季節鮮花訂閱（月配） | 890 | 100 |
