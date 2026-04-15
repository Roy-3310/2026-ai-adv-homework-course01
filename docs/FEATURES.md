# 功能清單與完成狀態 (FEATURES.md)

## 功能完成狀態總覽

| 功能模組 | 狀態 | 說明 |
|---------|------|------|
| 用戶認證（註冊/登入） | ✅ 完成 | JWT + bcrypt，7 天 Token |
| 商品瀏覽（列表/詳情） | ✅ 完成 | 公開 API，支援分頁 |
| 購物車（雙模式認證） | ✅ 完成 | JWT 已登入 + Session ID 遊客模式 |
| 訂單建立（原子交易） | ✅ 完成 | 含庫存扣除、價格快照、購物車清空 |
| 模擬付款 | ✅ 完成 | 非真實金流，success/fail 兩種結果 |
| 後台商品管理 | ✅ 完成 | 新增/編輯/刪除，有 pending 訂單不可刪除 |
| 後台訂單查看 | ✅ 完成 | 全訂單列表，可依狀態篩選 |
| OpenAPI 文件 | ✅ 完成 | 從 JSDoc 產生 openapi.json |
| ECPay 真實金流整合 | ✅ 完成 | AIO 付款表單跳轉 + QueryTradeInfo 主動查詢 |
| Email 發送（通知信） | ❌ 未實作 | 無任何 Email 發送機制 |
| 用戶 Email 驗證 | ❌ 未實作 | 可使用任意 Email 註冊 |
| 購物車合併（遊客→登入） | ❌ 未實作 | 登入後遊客購物車不會合併 |

---

## 功能模組詳細說明

### 1. 用戶認證

#### 端點

| Method | 路徑 | 說明 |
|--------|------|------|
| POST | `/api/auth/register` | 建立帳號，自動回傳 JWT |
| POST | `/api/auth/login` | 驗證 Email + 密碼，回傳 JWT |
| GET | `/api/auth/profile` | 回傳當前用戶資訊（需 JWT） |

#### 請求欄位

**register / login 共用欄位**：`email`（Email 格式）、`password`（最少 6 字元）；register 額外需要 `name`。

**register 回應 201**：`{ user: { id, email, name, role }, token }`

**login 回應 200**：`{ user: { id, email, name, role }, token }`

**profile 回應 200**：`{ id, email, name, role, created_at }`

#### 錯誤情境

| 情境 | HTTP | error |
|------|------|-------|
| 缺少必填欄位 | 400 | `VALIDATION_ERROR` |
| Email 格式不符 | 400 | `VALIDATION_ERROR` |
| 密碼少於 6 字元 | 400 | `VALIDATION_ERROR` |
| Email 已被註冊 | 409 | `CONFLICT` |
| 帳號或密碼錯誤 | 401 | `UNAUTHORIZED` |
| Token 無效或過期 | 401 | `UNAUTHORIZED` |

#### 業務邏輯

- 密碼 bcrypt 雜湊，`saltRounds`：測試環境 1、生產環境 10
- JWT Payload：`{ userId, email, role }`，有效期 7 天，無法提前撤銷
- `role` 預設 `'user'`，管理員需由種子數據建立

---

### 2. 商品瀏覽

商品 API 完全公開，無需認證。

**GET /api/products** — Query 參數：`page`（預設 1）、`limit`（預設 10，最大 100）

回應包含 `products` 陣列與 `pagination`（`total`、`page`、`limit`、`totalPages`）。

**GET /api/products/:id** — 回傳單一商品，不存在則 404 `NOT_FOUND`。

#### 業務邏輯

- `page` / `limit` 為非正整數時自動調整為最小值（page=1, limit=1）
- `stock` 欄位公開顯示，前端可根據庫存顯示「缺貨」

---

### 3. 購物車（雙模式認證）

購物車同時接受兩種認證模式，兩者資料完全獨立，不會互通或合併：

- **已登入**：`Authorization: Bearer <token>` → 以 `user_id` 儲存
- **遊客**：`X-Session-Id: <uuid>` → 以 `session_id` 儲存
- **兩者都無**：401 `UNAUTHORIZED`

#### 端點行為

| Method | 路徑 | 說明 |
|--------|------|------|
| GET | `/api/cart` | 回傳 `items` 陣列 + `total`（總金額） |
| POST | `/api/cart` | Body：`{ productId, quantity=1 }`，**已存在則累加**（非覆蓋） |
| PATCH | `/api/cart/:itemId` | Body：`{ quantity }`，**覆蓋**（非累加） |
| DELETE | `/api/cart/:itemId` | 移除單一商品 |

> 重要：POST 加入購物車採**累加**；PATCH 更新數量採**覆蓋**。

#### 錯誤情境

| 情境 | HTTP | error |
|------|------|-------|
| 無認證資訊 | 401 | `UNAUTHORIZED` |
| 商品不存在 | 404 | `NOT_FOUND` |
| 庫存不足 | 400 | `STOCK_INSUFFICIENT` |
| 購物車項目不存在 | 404 | `NOT_FOUND` |
| 操作他人購物車 | 404 | `NOT_FOUND`（刻意模糊） |

---

### 4. 訂單建立

從購物車建立訂單，必須登入（JWT）。過程為**原子交易**，任何步驟失敗完整 rollback。

#### 下單業務邏輯（Transaction 順序）

```
1. 取得用戶購物車（含庫存）
2. 驗證購物車不為空
3. 驗證所有商品庫存 >= 購買數量
4. 計算訂單總金額
5. 產生訂單編號（ORD-YYYYMMDD-XXXXX）
6. INSERT orders（status: 'pending'）
7. INSERT order_items（快照 product_name、product_price）
8. UPDATE products.stock（扣除）
9. DELETE cart_items（清空購物車）
```

> **庫存在下單時即扣除**（status='pending'），付款失敗不歸還庫存。

#### 請求欄位

**POST /api/orders** Body：`recipientName`、`recipientEmail`（Email 格式）、`recipientAddress`（均必填）

**成功回應 201**：`{ id, order_no, total_amount, status, items[], created_at }`

`items` 包含 `product_name`（快照）、`product_price`（快照）、`quantity`。

#### 錯誤情境

| 情境 | HTTP | error |
|------|------|-------|
| 未登入 | 401 | `UNAUTHORIZED` |
| 購物車為空 | 400 | `CART_EMPTY` |
| 庫存不足 | 400 | `STOCK_INSUFFICIENT` |
| 缺少收件資訊 | 400 | `VALIDATION_ERROR` |
| Email 格式錯誤 | 400 | `VALIDATION_ERROR` |

---

### 5. 訂單查詢

用戶只能查詢**自己的**訂單，列表按建立時間**倒序**排列。

**GET /api/orders** — 回傳 `orders` 陣列（含 `id`、`order_no`、`total_amount`、`status`、`created_at`）。

**GET /api/orders/:id** — 回傳完整訂單詳情（含 `recipient_*`、`items[]`），非本人訂單回傳 404。

訂單狀態值：`'pending'` | `'paid'` | `'failed'`

---

### 6. 模擬付款

非真實金流，用於測試訂單狀態流程。

#### 狀態流程

```
pending ──→ paid    (action: "success")
pending ──→ failed  (action: "fail")
paid / failed ──→ 不可再操作（400）
```

**PATCH /api/orders/:id/pay** Body：`{ action: "success" | "fail" }`

#### 錯誤情境

| 情境 | HTTP | error |
|------|------|-------|
| action 值不合法 | 400 | `VALIDATION_ERROR` |
| 訂單非 pending 狀態 | 400 | `INVALID_ORDER_STATUS` |
| 訂單不存在 | 404 | `NOT_FOUND` |

---

### 7. 後台商品管理

全部需要 JWT + `role === 'admin'`。

#### 端點

| Method | 路徑 | 說明 |
|--------|------|------|
| GET | `/api/admin/products` | 列表（page、limit 分頁） |
| POST | `/api/admin/products` | 新增商品 |
| PUT | `/api/admin/products/:id` | 全欄位更新 |
| DELETE | `/api/admin/products/:id` | 刪除（有 pending 訂單則 409） |

#### 新增/更新欄位

| 欄位 | 新增 | 更新 | 規則 |
|------|------|------|------|
| `name` | 必填 | 選填 | 字串 |
| `price` | 必填 | 選填 | 正整數 |
| `stock` | 必填 | 選填 | 非負整數 |
| `description` | 選填 | 選填 | 字串或 null |
| `image_url` | 選填 | 選填 | URL 字串或 null |

#### 刪除限制

查詢是否有 `status = 'pending'` 的 `order_items` 包含該商品：
- 有 → 409 `CONFLICT`（「此商品存在未完成的訂單，無法刪除」）
- 無（包含 paid/failed 訂單）→ 允許刪除

#### 錯誤情境

| 情境 | HTTP | error |
|------|------|-------|
| 未登入 | 401 | `UNAUTHORIZED` |
| 非管理員 | 403 | `FORBIDDEN` |
| 商品不存在 | 404 | `NOT_FOUND` |
| name 缺失 | 400 | `VALIDATION_ERROR` |
| price 非正整數 | 400 | `VALIDATION_ERROR` |
| stock 為負數 | 400 | `VALIDATION_ERROR` |
| 有 pending 訂單 | 409 | `CONFLICT` |

---

### 8. 後台訂單管理

管理員可查看**所有用戶**的訂單，支援依狀態篩選，無法直接修改訂單狀態。

**GET /api/admin/orders** — Query：`page`、`limit`、`status`（`pending`/`paid`/`failed`，選填）

回應包含 `orders` 陣列（含 `user_id`、`recipient_name` 等）與 `pagination`。

**GET /api/admin/orders/:id** — 回傳完整訂單（比用戶端多 `user: { name, email }` 欄位）。

> 無效的 `status` 值被忽略（不報錯），等同不篩選。

---

### 9. ECPay 綠界金流整合

#### 背景

整合綠界 AIO 付款服務。本機無法接收 ReturnURL 回呼，付款確認改由**使用者主動觸發**後端呼叫 `QueryTradeInfo`。

#### 付款流程

```
使用者 → GET /ecpay/checkout/:id?token=...
後端：取得/產生 ecpay_trade_no → 儲存至 DB → 產生含 CheckMacValue 的 AIO Form
使用者：瀏覽器自動跳轉綠界付款 → 完成後導回 /orders/:id?payment=return
使用者：點「確認付款結果」→ POST /api/orders/:id/ecpay-query
後端：QueryTradeInfo → TradeStatus='1' → UPDATE status='paid'
```

#### API 端點

**GET /ecpay/checkout/:orderId**
- 認證：JWT via query string `?token=`（瀏覽器 `<a>` 無法帶 header）
- 若訂單非 `pending`：302 重新導向 `/orders/:id`
- 回應：HTML（含自動 submit form）

**POST /ecpay/return**（ReturnURL 回呼，供 ngrok 測試）
- 驗證 CheckMacValue（`crypto.timingSafeEqual()`）
- `RtnCode === '1'` → 更新 status 為 `paid`
- 回應：純文字 `1|OK`，HTTP 200（綠界要求）

**POST /api/orders/:id/ecpay-query**（需 JWT）
- 前置檢查：訂單不存在/非本人 → 404；`status !== 'pending'` → 400 `INVALID_STATUS`；`ecpay_trade_no` 為 null → 400 `NOT_INITIATED`
- TradeStatus='1' → `{ status: 'paid' }`
- TradeStatus='0' → `{ status: 'pending' }`（待付款）
- 綠界呼叫異常 → 502 `ECPAY_ERROR`

#### AIO 付款關鍵參數

| 參數 | 值 |
|------|-----|
| `MerchantID` | `ECPAY_MERCHANT_ID` |
| `MerchantTradeNo` | `ecpay_trade_no`（最長 20 字元純英數） |
| `PaymentType` | `aio` |
| `ChoosePayment` | `ALL` |
| `EncryptType` | `1`（SHA256） |
| `ReturnURL` | `${BASE_URL}/ecpay/return` |
| `ClientBackURL` | `${BASE_URL}/orders/${orderId}?payment=return` |

#### 環境變數

| 變數 | 說明 |
|------|------|
| `ECPAY_MERCHANT_ID` | 綠界特店編號 |
| `ECPAY_HASH_KEY` | CheckMacValue HashKey |
| `ECPAY_HASH_IV` | CheckMacValue HashIV |
| `ECPAY_ENV` | `production` 為正式環境；其他使用測試環境 |
| `BASE_URL` | 完整網址（如 `http://localhost:3001`） |

#### CheckMacValue 計算（SHA256）

1. 過濾 `CheckMacValue` 欄位
2. 依參數名稱大小寫不敏感排序
3. 組成 `HashKey=...&params...&HashIV=...`
4. ECPay 專用 URL encode → SHA256 → 轉大寫 hex

---

## 非標準設計說明

### 雙模式認證購物車

遊客與登入用戶的購物車資料在 `cart_items` 表完全隔離（`session_id` vs `user_id`），登入後不合併。前端 `auth.js` 的 `getAuthHeaders()` 同時回傳兩個 header，由後端決定使用哪個。

### 訂單號碼格式

`ORD-YYYYMMDD-XXXXX`（XXXXX 為 5 碼隨機大寫英數，區分同日多筆訂單）。範例：`ORD-20240413-K7P2M`。

### 商品價格快照

`order_items.product_name` 和 `product_price` 是下單當下的快照，確保商品後續修改或刪除不影響歷史訂單顯示。

### 前端 401 自動處理

`public/js/api.js` 的 `apiFetch()` 收到 401 時自動清除 localStorage 並重定向 `/login`，所有頁面無需個別處理。
