# 開發規範 (DEVELOPMENT.md)

## 環境建置

### 前置需求

- Node.js 18+（建議使用 nvm 管理版本）
- npm 9+

### 初始化步驟

```bash
# 1. 安裝依賴
npm install

# 2. 複製環境變數範本
cp .env.example .env

# 3. 編輯 .env，設定必填項
#    JWT_SECRET 是唯一強制必填項，未設定時 server 啟動會 process.exit(1)

# 4. 啟動開發環境（需兩個終端）
# 終端 A：啟動 server
npm run dev:server

# 終端 B：監聽 CSS 變更
npm run dev:css

# 或一次性啟動（不監聽 CSS 變更）
npm start
```

---

## 環境變數說明

所有環境變數定義在 `.env`（本地開發）與 `.env.example`（範本，需提交 git）。

| 變數名稱 | 用途 | 必要性 | 預設值 |
|---------|------|--------|--------|
| `JWT_SECRET` | JWT Token 簽發與驗證的密鑰 | **必填** | 無（未設定則強制退出） |
| `PORT` | Express server 監聽的 port | 選填 | `3001` |
| `NODE_ENV` | 執行環境標識 | 選填 | `development` |
| `BASE_URL` | 伺服器基礎 URL（OpenAPI 文件用） | 選填 | `http://localhost:3001` |
| `FRONTEND_URL` | CORS 允許的前端來源 | 選填 | `http://localhost:5173` |
| `ADMIN_EMAIL` | 種子管理員帳號 Email | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 種子管理員帳號密碼 | 選填 | `12345678` |
| `ECPAY_MERCHANT_ID` | ECPay 特店編號（預留） | 選填 | `3002607` |
| `ECPAY_HASH_KEY` | ECPay HashKey（預留） | 選填 | `pwFHCqoQZGmho4w6` |
| `ECPAY_HASH_IV` | ECPay HashIV（預留） | 選填 | `EkRm7iFT261dpevs` |
| `ECPAY_ENV` | ECPay 環境（staging/production） | 選填 | `staging` |

> `NODE_ENV=test` 時，bcrypt saltRounds 自動從 10 降為 1，加快測試速度。

---

## 命名規則

### 後端 JavaScript

| 項目 | 規則 | 範例 |
|------|------|------|
| 變數、函式 | camelCase | `getUserToken`, `cartItems` |
| 常數（模組級） | UPPER_SNAKE_CASE | `TOKEN_KEY`, `SAFE_MESSAGES` |
| 檔案名稱（routes/middleware） | camelCase | `authRoutes.js`, `errorHandler.js` |
| 測試檔案 | camelCase + `.test.js` | `adminProducts.test.js` |

### 資料庫欄位

| 規則 | 範例 |
|------|------|
| snake_case | `user_id`, `product_name`, `created_at`, `order_no` |

### API 錯誤碼

| 規則 | 範例 |
|------|------|
| UPPER_SNAKE_CASE | `VALIDATION_ERROR`, `UNAUTHORIZED`, `STOCK_INSUFFICIENT` |

### 錯誤碼完整清單

| 錯誤碼 | 適用情境 |
|--------|---------|
| `VALIDATION_ERROR` | 請求參數格式錯誤、必填欄位缺失 |
| `UNAUTHORIZED` | 未提供 Token 或 Token 無效/過期 |
| `FORBIDDEN` | 已認證但無管理員權限 |
| `NOT_FOUND` | 資源不存在（商品、訂單、購物車項目） |
| `CONFLICT` | 衝突狀態（Email 重複、商品有未完成訂單） |
| `CART_EMPTY` | 購物車為空，無法建立訂單 |
| `STOCK_INSUFFICIENT` | 所求數量超過庫存 |
| `INVALID_ORDER_STATUS` | 訂單狀態不符合操作要求 |
| `INTERNAL_ERROR` | 500 伺服器內部錯誤（細節被隱藏） |

### 前端 JavaScript

| 項目 | 規則 | 範例 |
|------|------|------|
| 物件、命名空間 | PascalCase | `Auth`, `Notification` |
| 函式、變數 | camelCase | `apiFetch`, `getAuthHeaders` |
| localStorage key | snake_case 字串常數 | `'flower_token'`, `'flower_user'`, `'flower_session_id'` |

---

## 模組系統說明

本專案使用 **CommonJS（`require`/`module.exports`）** 模組系統。

```javascript
// 正確：使用 require/module.exports
const express = require('express');
const { db } = require('../database');
module.exports = router;

// 錯誤：不要使用 ESM import/export（package.json 未設定 "type": "module"）
import express from 'express';  // ❌
```

---

## 新增 API 路由的步驟

以新增「商品評論」功能為例：

### 1. 建立路由檔案

```javascript
// src/routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../database');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/reviews:
 *   post:
 *     summary: 新增評論
 *     ...
 */
router.post('/', authMiddleware, (req, res, next) => {
  try {
    // 1. 驗證參數
    const { productId, content, rating } = req.body;
    if (!productId || !content || !rating) {
      return res.status(400).json({
        data: null,
        error: 'VALIDATION_ERROR',
        message: 'productId、content、rating 為必填欄位'
      });
    }

    // 2. 業務邏輯
    // ...

    // 3. 回應
    return res.status(201).json({
      data: result,
      error: null,
      message: '評論新增成功'
    });
  } catch (err) {
    next(err);  // 傳遞給 errorHandler
  }
});

module.exports = router;
```

### 2. 在 app.js 掛載路由

```javascript
// app.js
const reviewRoutes = require('./src/routes/reviewRoutes');

// 在 API 路由區段加入（在 404 handler 之前）
app.use('/api/reviews', reviewRoutes);
```

### 3. 在 database.js 加入資料表（若需要）

```javascript
// src/database.js，在 initDatabase() 函式的 CREATE TABLE 區段加入
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id          TEXT PRIMARY KEY,
    product_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    content     TEXT NOT NULL,
    rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);
```

### 4. 撰寫測試

參考 `tests/` 目錄下的現有測試，建立 `tests/reviews.test.js`。

### 5. 更新文件

- `docs/FEATURES.md`：新增功能描述
- `docs/CHANGELOG.md`：新增 changelog 條目
- `vitest.config.js`：在 `sequence.files` 加入新測試檔案

---

## 新增 Middleware 的步驟

```javascript
// src/middleware/rateLimitMiddleware.js

/**
 * 簡單的速率限制 middleware
 * 使用方式：router.post('/login', rateLimitMiddleware, handler)
 */
function rateLimitMiddleware(req, res, next) {
  // 邏輯...
  // 若要阻擋請求：
  return res.status(429).json({
    data: null,
    error: 'RATE_LIMIT_EXCEEDED',
    message: '請求過於頻繁，請稍後再試'
  });
  // 若要放行：
  next();
}

module.exports = rateLimitMiddleware;
```

> 注意：errorHandler 是特殊的 4 參數 middleware `(err, req, res, next)`，其他 middleware 使用 3 參數 `(req, res, next)`。

---

## JSDoc 格式說明

所有路由均使用 JSDoc `@openapi` 標記，供 `npm run openapi` 產生 API 文件。

### 標準 JSDoc 格式範例

```javascript
/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: 取得商品列表
 *     description: 支援分頁，回傳商品陣列與分頁資訊
 *     tags:
 *       - Products
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: 每頁筆數（最大 100）
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                     pagination:
 *                       type: object
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 */
router.get('/', (req, res, next) => { ... });
```

---

## CSS 開發規範

### Tailwind CSS 編譯流程

```
public/css/input.css   →   @tailwindcss/cli   →   public/css/output.css
（源檔，可手動編輯）                              （編譯輸出，不可手動編輯）
```

### 開發時

```bash
# 監聽變更（開發模式，不壓縮）
npm run dev:css

# 一次性編譯（建置用，有壓縮）
npm run css:build
```

### 注意事項

- 不要直接編輯 `public/css/output.css`，每次編譯都會覆蓋
- 修改 EJS 模板中的 Tailwind class 後，需重新編譯 CSS 才能生效
- 若使用動態 class（如字串拼接），需在 `input.css` 的 `safelist` 中加入

---

## 計畫歸檔流程

### 計畫檔案命名格式

```
docs/plans/YYYY-MM-DD-<feature-name>.md
```

範例：`docs/plans/2026-04-13-order-payment.md`

### 計畫文件結構

```markdown
# [功能名稱] 開發計畫

## User Story
作為 [角色]，我想要 [功能]，以便 [目的]。

## Spec（功能規格）
- API 端點：...
- 請求格式：...
- 回應格式：...
- 錯誤情境：...

## Tasks
- [ ] 資料庫 Schema 設計
- [ ] API 路由實作
- [ ] 前端頁面 JS
- [ ] EJS 模板
- [ ] 測試撰寫
- [ ] 文件更新
```

### 完成後的步驟

1. 將計畫檔案從 `docs/plans/` **移動**至 `docs/plans/archive/`
2. 更新 `docs/FEATURES.md`：將功能狀態標記為完成（`[x]`）
3. 更新 `docs/CHANGELOG.md`：新增版本條目，說明功能內容

```bash
# 範例：計畫完成後歸檔
mv docs/plans/2026-04-13-order-payment.md docs/plans/archive/
```

---

## 資料庫操作規範

本專案使用 `better-sqlite3`，所有操作為**同步（synchronous）**：

```javascript
const { db } = require('../database');

// 查詢單筆
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// 查詢多筆
const products = db.prepare('SELECT * FROM products WHERE stock > 0').all();

// 插入/更新/刪除
const result = db.prepare('INSERT INTO users (id, email, ...) VALUES (?, ?, ...)').run(id, email, ...);

// Transaction（原子操作）
const createOrder = db.transaction((orderData) => {
  db.prepare('INSERT INTO orders ...').run(...);
  db.prepare('INSERT INTO order_items ...').run(...);
  db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, productId);
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
});

try {
  createOrder(data);
} catch (err) {
  // Transaction 自動 rollback
  next(err);
}
```

> 由於 `better-sqlite3` 是同步 API，不需要 `await`，所有查詢直接回傳結果。

---

## 前端頁面 JS 開發規範

### 頁面 JS 掛載方式

每個頁面的 EJS 模板透過 `pageScript` 變數決定要載入哪個 JS：

```ejs
<!-- views/layouts/front.ejs -->
<script src="/js/pages/<%= pageScript %>.js"></script>
```

```javascript
// src/routes/pageRoutes.js
router.get('/cart', (req, res) => {
  res.render('pages/cart', { 
    layout: 'front',
    pageScript: 'cart'   // 載入 /js/pages/cart.js
  });
});
```

### 頁面 JS 基本結構

```javascript
// public/js/pages/example.js

document.addEventListener('DOMContentLoaded', async () => {
  // 1. 認證檢查（若頁面需要登入）
  if (!Auth.requireAuth()) return;

  // 2. 初始化
  await loadData();

  // 3. 事件綁定
  document.getElementById('submit-btn').addEventListener('click', handleSubmit);
});

async function loadData() {
  try {
    const data = await apiFetch('/api/example');
    renderData(data);
  } catch (err) {
    Notification.show(err.data?.message || '載入失敗', 'error');
  }
}
```

---

## 常見問題

### Q1：JWT_SECRET 未設定，server 無法啟動

```bash
# 錯誤訊息
Error: JWT_SECRET environment variable is required

# 解決
echo "JWT_SECRET=your-secret-key-here" >> .env
```

### Q2：Tailwind CSS 樣式不生效

```bash
# 重新編譯 CSS
npm run css:build
# 或啟動監聽模式
npm run dev:css
```

### Q3：database.sqlite 被鎖定

```bash
# 檢查是否有其他 node 程序在執行
# Windows
tasklist | findstr node

# 若有舊程序，終止後重新啟動
```

### Q4：測試執行失敗，提示 JWT_SECRET 未設定

```bash
# 測試需要 JWT_SECRET，在 .env 中設定
JWT_SECRET=test-secret-for-development
```

### Q5：新增 API 路由後出現 404

確認在 `app.js` 中已使用 `app.use('/api/your-route', yourRouter)` 掛載，且在 404 handler **之前**。
