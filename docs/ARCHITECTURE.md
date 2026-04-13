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
├── .gitignore
├── swagger-config.js          # Swagger/OpenAPI 3.0 基礎設定（title、servers、securitySchemes）
├── generate-openapi.js        # 執行後從路由 JSDoc 產生 openapi.json
├── vitest.config.js           # Vitest 測試設定（執行順序、parallelism 設定）
├── database.sqlite            # SQLite 資料庫檔案（執行時自動建立）
├── database.sqlite-shm        # WAL 模式 shared memory 檔（自動產生，勿手動刪除）
├── database.sqlite-wal        # WAL 模式 write-ahead log 檔（自動產生，勿手動刪除）
│
├── src/                       # 後端核心程式碼
│   ├── database.js            # 資料庫連線、Schema 建立、種子數據插入、WAL/FK pragma
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT 驗證：解析 Bearer token，設置 req.user = {userId, email, role}
│   │   ├── adminMiddleware.js # 管理員權限：檢查 req.user.role === 'admin'，須在 authMiddleware 之後
│   │   ├── errorHandler.js    # 全域錯誤處理（4 參數格式），隱藏 500 細節，統一 JSON 格式
│   │   └── sessionMiddleware.js # 遊客 Session：從 X-Session-Id header 提取並設置 req.sessionId
│   ├── routes/
│   │   ├── authRoutes.js      # /api/auth：register、login、profile
│   │   ├── productRoutes.js   # /api/products：商品列表（分頁）、商品詳情（公開，無需認證）
│   │   ├── cartRoutes.js      # /api/cart：購物車 CRUD（Dual-Auth：JWT 或 Session ID 均可）
│   │   ├── orderRoutes.js     # /api/orders：建立訂單、訂單列表、訂單詳情、ECPay 查詢（需 JWT）
│   │   ├── ecpayRoutes.js     # /ecpay：AIO 付款表單產生、ReturnURL 回呼處理
│   │   ├── adminProductRoutes.js # /api/admin/products：後台商品管理（需 JWT + admin role）
│   │   ├── adminOrderRoutes.js   # /api/admin/orders：後台訂單查看（需 JWT + admin role）
│   │   └── pageRoutes.js      # 頁面路由：所有 EJS 頁面的渲染（/ 、/cart、/admin/… 等）
│   └── utils/
│       └── ecpay.js           # ECPay 工具：CheckMacValue 計算/驗證、AIO Form 產生、QueryTradeInfo 查詢
│
├── public/                    # 靜態資源（由 express.static 直接提供）
│   ├── css/
│   │   ├── input.css          # Tailwind CSS 源檔（@import "tailwindcss"）
│   │   └── output.css         # 編譯後的 CSS（自動產生，不可手動編輯）
│   └── js/
│       ├── api.js             # 前端 API 工具：apiFetch()，自動附加 auth headers，處理 401 重定向
│       ├── auth.js            # 前端認證管理：Auth 物件（localStorage 存取 token/user/session）
│       ├── notification.js    # Toast 通知：Notification.show(message, type)，3 秒後自動消失
│       ├── header-init.js     # 頁頭初始化：根據登入狀態顯示/隱藏導覽項目
│       └── pages/             # 各頁面專屬 JS（由 EJS 模板按需載入）
│           ├── index.js           # 首頁：商品列表渲染、加入購物車
│           ├── product-detail.js  # 商品詳情：顯示商品資訊、加入購物車
│           ├── cart.js            # 購物車：列表渲染、數量更新、移除商品
│           ├── checkout.js        # 結帳：顯示購物車摘要、收件資訊表單、提交訂單
│           ├── login.js           # 登入/註冊表單處理
│           ├── orders.js          # 我的訂單列表渲染
│           ├── order-detail.js    # 訂單詳情渲染、模擬付款按鈕
│           ├── admin-products.js  # 後台商品管理：新增/編輯/刪除商品表單與 API 呼叫
│           └── admin-orders.js    # 後台訂單管理：訂單列表渲染、狀態篩選
│
├── views/                     # EJS 模板（伺服器端渲染）
│   ├── layouts/
│   │   ├── front.ejs          # 前台共用佈局：head + header + [content] + footer + notification
│   │   └── admin.ejs          # 後台共用佈局：head + admin-header + sidebar + [content] + footer
│   ├── pages/
│   │   ├── index.ejs          # 首頁（使用 front.ejs 佈局）
│   │   ├── product-detail.ejs # 商品詳情頁
│   │   ├── cart.ejs           # 購物車頁
│   │   ├── checkout.ejs       # 結帳頁
│   │   ├── login.ejs          # 登入/註冊頁（單頁切換）
│   │   ├── orders.ejs         # 我的訂單列表頁
│   │   ├── order-detail.ejs   # 訂單詳情頁
│   │   ├── 404.ejs            # 404 頁面
│   │   └── admin/
│   │       ├── products.ejs   # 後台商品管理頁（使用 admin.ejs 佈局）
│   │       └── orders.ejs     # 後台訂單管理頁
│   └── partials/
│       ├── head.ejs           # HTML <head>（meta、CSS 引入）
│       ├── header.ejs         # 前台導覽列（Logo + 導覽選單 + 登入狀態）
│       ├── admin-header.ejs   # 後台頂部 bar
│       ├── admin-sidebar.ejs  # 後台側邊欄導覽
│       ├── footer.ejs         # 頁尾
│       └── notification.ejs   # Toast 通知 DOM 元素（#notification-toast）
│
├── tests/                     # 測試檔案（Vitest + supertest）
│   ├── setup.js               # 測試助手：app、request（supertest）、getAdminToken()、registerUser()
│   ├── auth.test.js           # 認證 API 測試
│   ├── products.test.js       # 商品 API 測試
│   ├── cart.test.js           # 購物車 API 測試（含遊客模式）
│   ├── orders.test.js         # 訂單 API 測試
│   ├── adminProducts.test.js  # 後台商品 API 測試
│   └── adminOrders.test.js    # 後台訂單 API 測試
│
└── docs/                      # 專案文件
    ├── README.md
    ├── ARCHITECTURE.md        # 本文件
    ├── DEVELOPMENT.md
    ├── FEATURES.md
    ├── TESTING.md
    ├── CHANGELOG.md
    └── plans/
        └── archive/           # 已完成計畫歸檔
```

---

## 啟動流程

```
npm start / node server.js
        │
        ├─ 1. 載入 .env（dotenv）
        ├─ 2. 驗證 JWT_SECRET 是否設定
        │      └─ 若未設定 → console.error + process.exit(1)
        ├─ 3. 初始化資料庫（src/database.js）
        │      ├─ 建立 SQLite 連線（database.sqlite）
        │      ├─ 設定 WAL 模式、啟用 Foreign Keys
        │      ├─ CREATE TABLE IF NOT EXISTS（users、products、cart_items、orders、order_items）
        │      ├─ 建立管理員帳號（若不存在）
        │      └─ 插入種子商品（若 products 表為空）
        ├─ 4. 初始化 Express app（app.js）
        │      ├─ 掛載 static、cors、json、urlencoded
        │      ├─ 掛載 sessionMiddleware（X-Session-Id 提取）
        │      ├─ 掛載 API 路由（/api/*）
        │      ├─ 掛載頁面路由（/）
        │      ├─ 掛載 404 handler
        │      └─ 掛載 errorHandler（4 參數，必須最後一個）
        └─ 5. app.listen(PORT)
               └─ 預設 PORT = 3001
```

---

## Middleware 掛載順序與行為

掛載順序決定請求處理流程，**順序不可調換**：

| 順序 | Middleware | 說明 |
|------|-----------|------|
| 1 | `express.static('public')` | 靜態資源（CSS/JS）直接回傳，不進入後續 middleware |
| 2 | `cors(origin: FRONTEND_URL)` | 設定跨域允許來源（`process.env.FRONTEND_URL`） |
| 3 | `express.json()` | 解析 JSON request body，設置 `req.body` |
| 4 | `express.urlencoded({extended: false})` | 解析 form-urlencoded body |
| 5 | `sessionMiddleware` | 提取 `X-Session-Id` header，設置 `req.sessionId` |
| 6 | API 路由（`/api/*`） | 各功能 API |
| 7 | 頁面路由（`/`） | EJS 渲染 |
| 8 | 404 handler | 未匹配路由回傳 404 |
| 9 | `errorHandler(err, req, res, next)` | **必須是最後一個**，4 參數 signature 是 Express 識別 error handler 的標誌 |

### authMiddleware 行為

```
請求進入
  │
  ├─ 取出 Authorization header
  ├─ 驗證格式：必須是 "Bearer <token>"
  ├─ jwt.verify(token, JWT_SECRET)
  │   ├─ 失敗（過期/無效）→ 401 UNAUTHORIZED
  │   └─ 成功 → 取得 payload { userId, email, role }
  ├─ 查詢 users 表確認用戶存在（防止 token 有效但用戶已刪除）
  │   └─ 不存在 → 401 UNAUTHORIZED
  ├─ 設置 req.user = { userId, email, role }
  └─ next()
```

### adminMiddleware 行為

```
（必須在 authMiddleware 之後執行，依賴 req.user）
  │
  ├─ 檢查 req.user.role === 'admin'
  │   ├─ 不是 admin → 403 FORBIDDEN
  │   └─ 是 admin → next()
```

### sessionMiddleware 行為

```
提取 req.headers['x-session-id']
  │
  ├─ 有值 → req.sessionId = header 值
  └─ 無值 → req.sessionId = null
（不阻擋請求，購物車路由自行判斷）
```

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
| POST | `/api/orders/:id/ecpay-query` | JWT | 主動向綠界查詢交易狀態，更新訂單 |

### ECPay 金流 API

| Method | 路徑 | 認證 | 說明 |
|--------|------|------|------|
| GET | `/ecpay/checkout/:orderId` | JWT（query string `?token=`） | 產生 AIO 付款表單並自動跳轉至綠界 |
| POST | `/ecpay/return` | 無（CheckMacValue 驗證） | 綠界 ReturnURL 回呼，驗證並更新訂單狀態 |

### 後台商品 API

| Method | 路徑 | 認證 | 說明 |
|--------|------|------|------|
| GET | `/api/admin/products` | JWT + admin | 後台商品列表（分頁） |
| POST | `/api/admin/products` | JWT + admin | 新增商品 |
| PUT | `/api/admin/products/:id` | JWT + admin | 編輯商品（全欄位更新） |
| DELETE | `/api/admin/products/:id` | JWT + admin | 刪除商品（有 pending 訂單則 409） |

### 後台訂單 API

| Method | 路徑 | 認證 | 說明 |
|--------|------|------|------|
| GET | `/api/admin/orders` | JWT + admin | 後台訂單列表（分頁，可依狀態篩選） |
| GET | `/api/admin/orders/:id` | JWT + admin | 後台訂單詳情（含訂購人資訊） |

### 頁面路由

| Method | 路徑 | 說明 |
|--------|------|------|
| GET | `/` | 首頁（商品列表） |
| GET | `/products/:id` | 商品詳情頁 |
| GET | `/cart` | 購物車頁 |
| GET | `/checkout` | 結帳頁 |
| GET | `/login` | 登入/註冊頁 |
| GET | `/orders` | 我的訂單列表 |
| GET | `/orders/:id` | 訂單詳情頁 |
| GET | `/admin/products` | 後台商品管理 |
| GET | `/admin/orders` | 後台訂單管理 |

---

## 統一回應格式

所有 API 均使用相同的 JSON 回應結構：

```json
{
  "data": null,
  "error": null,
  "message": "成功"
}
```

- `data`：成功時包含業務數據，失敗時固定為 `null`
- `error`：成功時固定為 `null`，失敗時為錯誤碼字串（如 `"UNAUTHORIZED"`）
- `message`：人類可讀的中文說明

### 成功範例（GET /api/products）

```json
{
  "data": {
    "products": [
      {
        "id": "uuid-here",
        "name": "粉色玫瑰花束",
        "description": "...",
        "price": 1680,
        "stock": 30,
        "image_url": "https://...",
        "created_at": "2024-04-13T00:00:00",
        "updated_at": "2024-04-13T00:00:00"
      }
    ],
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "error": null,
  "message": "成功"
}
```

### 失敗範例（401）

```json
{
  "data": null,
  "error": "UNAUTHORIZED",
  "message": "請先登入"
}
```

### 常見錯誤碼

| HTTP 狀態碼 | error 欄位值 | 說明 |
|------------|-------------|------|
| 400 | `VALIDATION_ERROR` | 請求參數驗證失敗 |
| 400 | `CART_EMPTY` | 購物車為空，無法建立訂單 |
| 400 | `STOCK_INSUFFICIENT` | 庫存不足 |
| 401 | `UNAUTHORIZED` | 未提供 Token 或 Token 無效/過期 |
| 403 | `FORBIDDEN` | 已認證但無管理員權限 |
| 404 | `NOT_FOUND` | 資源不存在 |
| 409 | `CONFLICT` | 衝突（如 Email 重複、商品有未完成訂單） |
| 500 | `INTERNAL_ERROR` | 伺服器內部錯誤（細節被隱藏） |

---

## 認證與授權機制

### JWT 設定

| 參數 | 值 |
|------|-----|
| 演算法 | HS256 |
| 有效期 | 7 天（`expiresIn: '7d'`） |
| Payload 欄位 | `userId`、`email`、`role` |
| 密鑰來源 | `process.env.JWT_SECRET` |
| 無效處理 | 401 + 前端自動清除 localStorage + 重定向 `/login` |

### 前端 Token 儲存

```
localStorage
  ├── flower_token          JWT Token 字串
  ├── flower_user           用戶資訊 JSON（id, email, name, role）
  └── flower_session_id     遊客 Session UUID（crypto.randomUUID() 產生）
```

### 授權流程

```
前端 apiFetch() 呼叫
  │
  ├─ Auth.getToken() 存在 → 附加 Authorization: Bearer <token>
  ├─ Auth.getSessionId() → 附加 X-Session-Id: <uuid>
  │
  └─ 伺服器端
       ├─ authMiddleware（需 JWT 的路由）
       │    └─ req.user = { userId, email, role }
       ├─ adminMiddleware（需管理員的路由）
       │    └─ 確認 req.user.role === 'admin'
       └─ sessionMiddleware（所有路由）
            └─ req.sessionId = X-Session-Id 值
```

---

## 資料庫 Schema

### 連線設定

```javascript
// src/database.js
const db = new Database('database.sqlite');
db.pragma('journal_mode = WAL');   // WAL 模式提升並發讀寫效能
db.pragma('foreign_keys = ON');    // 強制外鍵約束（SQLite 預設關閉）
```

> 警告：WAL 模式會產生 `database.sqlite-shm` 和 `database.sqlite-wal` 輔助檔。若強制刪除這些檔案可能導致資料庫損毀。

### users 表

```sql
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,                            -- UUID v4
  email        TEXT UNIQUE NOT NULL,                        -- 唯一電子郵件
  password_hash TEXT NOT NULL,                              -- bcrypt 雜湊（rounds: 10 prod / 1 test）
  name         TEXT NOT NULL,                               -- 顯示名稱
  role         TEXT NOT NULL DEFAULT 'user'
               CHECK(role IN ('user', 'admin')),            -- 角色：user 或 admin
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))      -- ISO 8601 字串
);
```

### products 表

```sql
CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,                            -- UUID v4
  name         TEXT NOT NULL,                               -- 商品名稱
  description  TEXT,                                        -- 商品描述（可為 null）
  price        INTEGER NOT NULL CHECK(price > 0),           -- 價格（正整數，新台幣）
  stock        INTEGER NOT NULL DEFAULT 0
               CHECK(stock >= 0),                           -- 庫存數量（非負整數）
  image_url    TEXT,                                        -- 商品圖片 URL（可為 null）
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))      -- 更新時需手動設置
);
```

### cart_items 表

```sql
CREATE TABLE IF NOT EXISTS cart_items (
  id          TEXT PRIMARY KEY,                             -- UUID v4
  session_id  TEXT,                                         -- 遊客識別（X-Session-Id header 值）
  user_id     TEXT,                                         -- 登入用戶（外鍵 users.id）
  product_id  TEXT NOT NULL,                                -- 商品（外鍵 products.id）
  quantity    INTEGER NOT NULL DEFAULT 1
              CHECK(quantity > 0),                          -- 購買數量（正整數）
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

> 重要：`session_id` 和 `user_id` 擇一使用，不會同時有值。遊客購物車用 `session_id`；登入用戶用 `user_id`。

### orders 表

```sql
CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY,                       -- UUID v4
  order_no          TEXT UNIQUE NOT NULL,                   -- 訂單編號，格式：ORD-YYYYMMDD-XXXXX
  user_id           TEXT NOT NULL,                          -- 訂購人（外鍵 users.id）
  recipient_name    TEXT NOT NULL,                          -- 收件人姓名
  recipient_email   TEXT NOT NULL,                          -- 收件人 Email
  recipient_address TEXT NOT NULL,                          -- 收件地址
  total_amount      INTEGER NOT NULL,                       -- 訂單總金額（計算自 order_items）
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'paid', 'failed')), -- 訂單狀態
  ecpay_trade_no    TEXT,                                   -- 綠界交易編號（20 字元英數，首次發起付款時產生）
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

> `ecpay_trade_no` 為後置 migration（`ALTER TABLE ADD COLUMN`，idempotent），初始為 null。首次點擊「前往綠界付款」時產生並寫入；若重新付款則沿用同一編號。

### order_items 表

```sql
CREATE TABLE IF NOT EXISTS order_items (
  id            TEXT PRIMARY KEY,                           -- UUID v4
  order_id      TEXT NOT NULL,                              -- 所屬訂單（外鍵 orders.id）
  product_id    TEXT NOT NULL,                              -- 對應商品（外鍵，但為快照目的保留）
  product_name  TEXT NOT NULL,                              -- 下單時的商品名稱快照（商品改名不影響訂單）
  product_price INTEGER NOT NULL,                           -- 下單時的商品價格快照（商品改價不影響訂單）
  quantity      INTEGER NOT NULL,                           -- 購買數量
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

> 關鍵設計：`order_items` 儲存下單當下的商品名稱與價格快照，確保訂單記錄不受後續商品修改影響。

---

## 資料流程圖

### 購物流程

```
[瀏覽商品] GET /api/products
     │
     ↓
[商品詳情] GET /api/products/:id
     │
     ↓
[加入購物車] POST /api/cart
  ├─ 遊客：X-Session-Id header → cart_items.session_id
  └─ 登入：Authorization header → cart_items.user_id
     │
     ↓
[結帳] POST /api/orders  ←── 需要 JWT 認證
  ├─ 檢查購物車不為空
  ├─ 檢查所有商品庫存足夠
  └─ Transaction:
       ├─ INSERT orders (status: 'pending')
       ├─ INSERT order_items（快照名稱、價格）
       ├─ UPDATE products.stock（扣除）
       └─ DELETE cart_items
     │
     ↓
[發起綠界付款] GET /ecpay/checkout/:id?token=...
  ├─ 驗證 JWT（query string）
  ├─ 取得或產生 ecpay_trade_no，寫入 orders 表
  └─ 回傳 AIO HTML Form → 瀏覽器自動跳轉至綠界
     │
     ↓ （使用者在綠界完成付款，瀏覽器導回 ClientBackURL）
     │
[確認付款結果] POST /api/orders/:id/ecpay-query
  ├─ 呼叫綠界 QueryTradeInfo API
  ├─ TradeStatus='1' → UPDATE orders SET status='paid'
  └─ TradeStatus='0' → 不更新，回傳待付款訊息
```

### 認證流程

```
[登入/註冊] POST /api/auth/login
  └─ 驗證成功 → 回傳 JWT Token（7 天有效）
       │
       ↓
  前端 localStorage.setItem('flower_token', token)
       │
       ↓
  後續請求 → apiFetch() 自動附加 Authorization: Bearer <token>
       │
       ├─ 401 回應 → 清除 localStorage → 重定向 /login
       └─ 正常回應 → 處理資料
```

---

## 種子數據

### 管理員帳號

每次啟動時自動建立（若不存在）：

| 欄位 | 值 |
|------|-----|
| email | `admin@hexschool.com`（可由 `ADMIN_EMAIL` 環境變數覆寫） |
| password | `12345678`（可由 `ADMIN_PASSWORD` 環境變數覆寫） |
| name | 管理員 |
| role | admin |

### 商品種子（8 個花卉商品）

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

> 種子商品僅在 `products` 表為空時插入（每次啟動都會檢查）。
