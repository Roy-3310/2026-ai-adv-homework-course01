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
| ECPay 真實金流整合 | ❌ 未實作 | 環境變數已預留，尚未整合 |
| Email 發送（通知信） | ❌ 未實作 | 無任何 Email 發送機制 |
| 用戶 Email 驗證 | ❌ 未實作 | 可使用任意 Email 註冊 |
| 購物車合併（遊客→登入） | ❌ 未實作 | 登入後遊客購物車不會合併 |

---

## 功能模組詳細說明

---

### 1. 用戶認證

#### 行為描述

系統提供三個認證 API：

- **註冊（POST /api/auth/register）**：建立新帳號，自動回傳 JWT Token，無需再次登入
- **登入（POST /api/auth/login）**：驗證 Email + 密碼，回傳 JWT Token
- **個人資料（GET /api/auth/profile）**：回傳當前登入用戶的基本資訊

#### 請求與回應格式

**POST /api/auth/register**

```json
// Request Body（必填欄位）
{
  "email": "user@example.com",   // 必填，需符合 Email 格式（/^[^\s@]+@[^\s@]+\.[^\s@]+$/）
  "password": "mypassword",      // 必填，最少 6 字元
  "name": "王小明"               // 必填
}

// 成功回應 201
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "王小明",
      "role": "user"
    },
    "token": "eyJhbGci..."       // JWT Token，有效期 7 天
  },
  "error": null,
  "message": "註冊成功"
}
```

**POST /api/auth/login**

```json
// Request Body
{
  "email": "user@example.com",   // 必填
  "password": "mypassword"       // 必填
}

// 成功回應 200
{
  "data": {
    "user": { "id", "email", "name", "role" },
    "token": "eyJhbGci..."
  },
  "error": null,
  "message": "登入成功"
}
```

**GET /api/auth/profile**

```json
// 需要 Header：Authorization: Bearer <token>

// 成功回應 200
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "王小明",
    "role": "user",
    "created_at": "2024-04-13T00:00:00"
  },
  "error": null,
  "message": "成功"
}
```

#### 錯誤情境

| 情境 | HTTP | error | message |
|------|------|-------|---------|
| 缺少必填欄位 | 400 | `VALIDATION_ERROR` | email、password、name 為必填欄位 |
| Email 格式不符 | 400 | `VALIDATION_ERROR` | Email 格式不正確 |
| 密碼少於 6 字元 | 400 | `VALIDATION_ERROR` | 密碼至少需要 6 個字元 |
| Email 已被註冊 | 409 | `CONFLICT` | 此 Email 已被使用 |
| 帳號或密碼錯誤 | 401 | `UNAUTHORIZED` | Email 或密碼不正確 |
| Token 無效或過期 | 401 | `UNAUTHORIZED` | Token 無效或已過期 |

#### 業務邏輯說明

- 密碼使用 bcrypt 雜湊後儲存，`saltRounds` 在測試環境為 1、生產環境為 10
- JWT Payload 包含 `{ userId, email, role }`，有效期 7 天，無法提前撤銷（無黑名單機制）
- 用戶 `role` 預設為 `'user'`，管理員帳號需由種子數據建立（無升級 API）

---

### 2. 商品瀏覽

#### 行為描述

商品 API 完全公開，無需認證。提供商品列表（含分頁）與單一商品詳情。

#### 請求與回應格式

**GET /api/products**

```
// Query 參數
page  : integer, 預設 1，最小 1
limit : integer, 預設 10，最大 100

// 範例：GET /api/products?page=2&limit=5
```

```json
// 成功回應 200
{
  "data": {
    "products": [
      {
        "id": "uuid",
        "name": "粉色玫瑰花束",
        "description": "...",
        "price": 1680,
        "stock": 30,
        "image_url": "https://images.unsplash.com/...",
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

**GET /api/products/:id**

```json
// 成功回應 200
{
  "data": {
    "id": "uuid",
    "name": "粉色玫瑰花束",
    "description": "...",
    "price": 1680,
    "stock": 30,
    "image_url": "...",
    "created_at": "...",
    "updated_at": "..."
  },
  "error": null,
  "message": "成功"
}

// 商品不存在 404
{ "data": null, "error": "NOT_FOUND", "message": "找不到該商品" }
```

#### 業務邏輯說明

- 分頁查詢：若 `page` 或 `limit` 為非正整數，自動調整為最小值（page=1, limit=1）
- 商品按 `created_at` 排序（預設，但未明確指定 ORDER BY）
- `stock` 欄位公開顯示，前端可根據庫存數量顯示「缺貨」提示

---

### 3. 購物車（雙模式認證）

#### 行為描述

購物車是本專案最特殊的設計。購物車 API 同時接受兩種認證模式：

- **已登入模式**：`Authorization: Bearer <token>` → 購物車項目以 `user_id` 儲存
- **遊客模式**：`X-Session-Id: <uuid>` → 購物車項目以 `session_id` 儲存

兩種模式的購物車資料**完全獨立**，登入後遊客購物車不會自動合併。

#### 認證判斷邏輯

```
請求進入購物車路由
  │
  ├─ 有 Authorization header 且 JWT 有效 → 使用 req.user.userId
  ├─ 有 X-Session-Id header → 使用 req.sessionId
  └─ 兩者都沒有 → 401 UNAUTHORIZED
```

#### 請求與回應格式

**GET /api/cart**

```json
// 成功回應 200
{
  "data": {
    "items": [
      {
        "id": "cart-item-uuid",
        "product_id": "product-uuid",
        "quantity": 2,
        "product": {
          "name": "粉色玫瑰花束",
          "price": 1680,
          "stock": 30,
          "image_url": "..."
        }
      }
    ],
    "total": 3360
  },
  "error": null,
  "message": "成功"
}
```

**POST /api/cart**

```json
// Request Body
{
  "productId": "product-uuid",   // 必填
  "quantity": 2                  // 選填，預設 1，必須為正整數
}

// 成功回應 200（新增或更新）
{
  "data": {
    "id": "cart-item-uuid",
    "product_id": "product-uuid",
    "quantity": 3    // 若商品已存在購物車，數量累加（不是覆蓋）
  },
  "error": null,
  "message": "已加入購物車"
}
```

> 重要：若商品已在購物車，`POST /api/cart` 會**累加**數量，不是覆蓋。例如：購物車已有 1 個，再 POST quantity=2，結果為 3 個。

**PATCH /api/cart/:itemId**

```json
// Request Body
{
  "quantity": 5    // 必填，正整數，新的數量（覆蓋，不累加）
}

// 成功回應 200
{
  "data": {
    "id": "cart-item-uuid",
    "product_id": "product-uuid",
    "quantity": 5
  },
  "error": null,
  "message": "數量已更新"
}
```

**DELETE /api/cart/:itemId**

```json
// 成功回應 200
{ "data": null, "error": null, "message": "已從購物車移除" }
```

#### 錯誤情境

| 情境 | HTTP | error | message |
|------|------|-------|---------|
| 無認證資訊（無 JWT 也無 Session） | 401 | `UNAUTHORIZED` | 請先登入 |
| 商品不存在 | 404 | `NOT_FOUND` | 找不到該商品 |
| 庫存不足（加入或更新） | 400 | `STOCK_INSUFFICIENT` | 庫存不足 |
| 購物車項目不存在 | 404 | `NOT_FOUND` | 找不到該購物車項目 |
| 操作他人的購物車項目 | 404 | `NOT_FOUND` | 找不到該購物車項目（刻意模糊） |

---

### 4. 訂單建立

#### 行為描述

從當前購物車建立訂單，必須登入（JWT）。訂單建立過程為**原子交易**，任何步驟失敗都會完整 rollback。

#### 下單業務邏輯（Transaction 順序）

```
1. 取得用戶購物車所有項目（含商品庫存）
2. 驗證購物車不為空
3. 驗證所有商品庫存 >= 購買數量
4. 計算訂單總金額（sum of price * quantity）
5. 產生訂單編號（格式：ORD-YYYYMMDD-XXXXX，XXXXX 為隨機 5 碼大寫英數）
6. INSERT INTO orders（status 預設 'pending'）
7. INSERT INTO order_items（快照每個商品的 product_name、product_price）
8. UPDATE products SET stock = stock - quantity（扣除庫存）
9. DELETE FROM cart_items WHERE user_id = ?（清空購物車）
```

> 關鍵：**庫存在下單時（status='pending'）即扣除**，不是在付款時扣除。付款失敗（status='failed'）不會歸還庫存。

#### 請求與回應格式

**POST /api/orders**

```json
// Headers: Authorization: Bearer <token>

// Request Body
{
  "recipientName": "王小明",           // 必填
  "recipientEmail": "user@example.com", // 必填，需符合 Email 格式
  "recipientAddress": "台北市信義區..."  // 必填
}

// 成功回應 201
{
  "data": {
    "id": "order-uuid",
    "order_no": "ORD-20240413-A3F7K",
    "total_amount": 3360,
    "status": "pending",
    "items": [
      {
        "product_name": "粉色玫瑰花束",   // 快照，不隨商品修改而變
        "product_price": 1680,            // 快照，不隨商品改價而變
        "quantity": 2
      }
    ],
    "created_at": "2024-04-13T10:00:00"
  },
  "error": null,
  "message": "訂單建立成功"
}
```

#### 錯誤情境

| 情境 | HTTP | error | message |
|------|------|-------|---------|
| 未登入 | 401 | `UNAUTHORIZED` | 請先登入 |
| 購物車為空 | 400 | `CART_EMPTY` | 購物車是空的 |
| 庫存不足 | 400 | `STOCK_INSUFFICIENT` | 商品 [名稱] 庫存不足 |
| 缺少收件資訊 | 400 | `VALIDATION_ERROR` | recipientName、recipientEmail、recipientAddress 為必填 |
| recipientEmail 格式錯誤 | 400 | `VALIDATION_ERROR` | 收件人 Email 格式不正確 |

---

### 5. 訂單查詢

#### 行為描述

用戶只能查詢**自己的**訂單。訂單列表按建立時間**倒序**排列（最新的在前）。

#### 請求與回應格式

**GET /api/orders**

```json
// Headers: Authorization: Bearer <token>

// 成功回應 200
{
  "data": {
    "orders": [
      {
        "id": "order-uuid",
        "order_no": "ORD-20240413-A3F7K",
        "total_amount": 3360,
        "status": "pending",         // 'pending' | 'paid' | 'failed'
        "created_at": "2024-04-13T10:00:00"
      }
    ]
  },
  "error": null,
  "message": "成功"
}
```

**GET /api/orders/:id**

```json
// 成功回應 200
{
  "data": {
    "id": "order-uuid",
    "order_no": "ORD-20240413-A3F7K",
    "recipient_name": "王小明",
    "recipient_email": "user@example.com",
    "recipient_address": "台北市...",
    "total_amount": 3360,
    "status": "pending",
    "created_at": "2024-04-13T10:00:00",
    "items": [
      {
        "product_name": "粉色玫瑰花束",
        "product_price": 1680,
        "quantity": 2
      }
    ]
  },
  "error": null,
  "message": "成功"
}

// 訂單不存在，或非本人訂單 → 404
{ "data": null, "error": "NOT_FOUND", "message": "找不到該訂單" }
```

---

### 6. 模擬付款

#### 行為描述

模擬付款 API 讓前端可以控制付款成功或失敗的結果，用於測試訂單狀態流程。**非真實金流**。

#### 狀態流程

```
pending ──→ paid    (action: "success")
pending ──→ failed  (action: "fail")
paid    ──→ 不可再操作（400）
failed  ──→ 不可再操作（400）
```

#### 請求與回應格式

**PATCH /api/orders/:id/pay**

```json
// Headers: Authorization: Bearer <token>

// Request Body
{
  "action": "success"   // 或 "fail"，其他值返回 400
}

// 成功回應 200（action: "success"）
{
  "data": {
    "id": "order-uuid",
    "order_no": "ORD-20240413-A3F7K",
    "status": "paid",
    "items": [...],
    ...
  },
  "error": null,
  "message": "付款成功"
}

// 成功回應 200（action: "fail"）
{
  "data": { ...order, "status": "failed" },
  "error": null,
  "message": "付款失敗"
}
```

#### 錯誤情境

| 情境 | HTTP | error | message |
|------|------|-------|---------|
| action 值不合法 | 400 | `VALIDATION_ERROR` | action 必須為 success 或 fail |
| 訂單狀態不是 pending | 400 | `INVALID_ORDER_STATUS` | 此訂單已完成付款流程 |
| 訂單不存在 | 404 | `NOT_FOUND` | 找不到該訂單 |

---

### 7. 後台商品管理

#### 行為描述

後台 API 全部需要 JWT 認證且 `role` 必須為 `'admin'`。提供商品的完整 CRUD。

#### 刪除限制（關鍵業務規則）

刪除商品時，系統會查詢是否有任何訂單包含該商品且訂單狀態為 `'pending'`：
- 若有 → 返回 409 CONFLICT，拒絕刪除
- 若無（包含 paid/failed 訂單）→ 允許刪除

**設計理由**：保護未完成訂單的商品資訊完整性，避免訂購人因商品被刪除而無法查看訂單詳情。

#### 請求與回應格式

**GET /api/admin/products**

```
// Query 參數（同公開商品 API）
page  : integer, 預設 1
limit : integer, 預設 10，最大 100
```

**POST /api/admin/products**

```json
// Request Body
{
  "name": "新商品名稱",         // 必填
  "description": "商品描述",   // 選填
  "price": 1500,               // 必填，正整數
  "stock": 20,                 // 必填，非負整數
  "image_url": "https://..."   // 選填
}

// 成功回應 201
{
  "data": {
    "id": "uuid",
    "name": "新商品名稱",
    "description": "商品描述",
    "price": 1500,
    "stock": 20,
    "image_url": "...",
    "created_at": "...",
    "updated_at": "..."
  },
  "error": null,
  "message": "商品新增成功"
}
```

**PUT /api/admin/products/:id**

```json
// Request Body（所有欄位皆為選填，只更新提供的欄位）
{
  "name": "修改後名稱",    // 選填
  "price": 1800,           // 選填
  "stock": 25              // 選填
}

// 成功回應 200
{ "data": { ...完整更新後的商品 }, "error": null, "message": "商品更新成功" }
```

**DELETE /api/admin/products/:id**

```json
// 成功回應 200
{ "data": null, "error": null, "message": "商品刪除成功" }

// 有 pending 訂單 409
{ "data": null, "error": "CONFLICT", "message": "此商品存在未完成的訂單，無法刪除" }
```

#### 錯誤情境

| 情境 | HTTP | error | message |
|------|------|-------|---------|
| 未登入 | 401 | `UNAUTHORIZED` | 請先登入 |
| 非管理員 | 403 | `FORBIDDEN` | 權限不足 |
| 商品不存在 | 404 | `NOT_FOUND` | 找不到該商品 |
| name 缺失 | 400 | `VALIDATION_ERROR` | name 為必填欄位 |
| price 不是正整數 | 400 | `VALIDATION_ERROR` | price 必須為正整數 |
| stock 為負數 | 400 | `VALIDATION_ERROR` | stock 不能為負數 |
| 有 pending 訂單 | 409 | `CONFLICT` | 此商品存在未完成的訂單，無法刪除 |

---

### 8. 後台訂單管理

#### 行為描述

管理員可查看**所有用戶**的訂單（不限制 user_id），支援依狀態篩選。無法直接修改訂單狀態（訂單狀態由用戶端模擬付款 API 觸發）。

#### 請求與回應格式

**GET /api/admin/orders**

```
// Query 參數
page   : integer, 預設 1
limit  : integer, 預設 10
status : 'pending' | 'paid' | 'failed'（選填，不填則查全部）
         ← 其他值被忽略（不報錯，等同不篩選）
```

```json
// 成功回應 200
{
  "data": {
    "orders": [
      {
        "id": "order-uuid",
        "order_no": "ORD-20240413-A3F7K",
        "user_id": "user-uuid",
        "recipient_name": "王小明",
        "recipient_email": "user@example.com",
        "total_amount": 3360,
        "status": "pending",
        "created_at": "2024-04-13T10:00:00"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  },
  "error": null,
  "message": "成功"
}
```

**GET /api/admin/orders/:id**

```json
// 成功回應 200（比用戶端多了 user 欄位）
{
  "data": {
    "id": "order-uuid",
    "order_no": "ORD-20240413-A3F7K",
    "user_id": "user-uuid",
    "recipient_name": "王小明",
    "recipient_email": "user@example.com",
    "recipient_address": "台北市...",
    "total_amount": 3360,
    "status": "pending",
    "created_at": "...",
    "items": [
      {
        "id": "order-item-uuid",
        "product_id": "product-uuid",
        "product_name": "粉色玫瑰花束",
        "product_price": 1680,
        "quantity": 2
      }
    ],
    "user": {
      "name": "王小明",
      "email": "user@example.com"
    }
  },
  "error": null,
  "message": "成功"
}
```

---

## 非標準設計與特殊機制

### 雙模式認證購物車（Dual-Auth Cart）

這是本專案最重要的非標準機制。大多數電商選擇「必須登入才能購物」或「登入後合併購物車」，本專案選擇「兩種身份完全獨立」的設計：

```
遊客                          已登入用戶
X-Session-Id: abc123          Authorization: Bearer eyJ...
       │                              │
       ↓                              ↓
cart_items.session_id='abc123'  cart_items.user_id='user-uuid'
       │                              │
      （兩者完全隔離，不會合併）
```

**前端處理**：`auth.js` 的 `getAuthHeaders()` 方法同時回傳兩個 header，由後端決定使用哪個。

### 訂單號碼格式

```
ORD-YYYYMMDD-XXXXX
     │         └─ 5 碼隨機大寫英數（用於區分同日多筆訂單）
     └─ 下單日期
```

範例：`ORD-20240413-K7P2M`

### 商品價格快照機制

`order_items` 表儲存的 `product_name` 和 `product_price` 是**下單當下的快照**：

```sql
-- 下單時：將當前商品名稱和價格複製到 order_items
INSERT INTO order_items (product_name, product_price, ...)
VALUES (?, ?, ...)
-- product_name 和 product_price 來自下單時的 products 查詢結果
```

這確保商品後續被修改（改名、改價）或刪除，不影響歷史訂單的顯示。

### 前端 401 自動處理

`public/js/api.js` 的 `apiFetch()` 函式在收到 401 回應時自動執行：

```javascript
if (res.status === 401) {
  localStorage.removeItem('flower_token');
  localStorage.removeItem('flower_user');
  window.location.href = '/login';
  return;  // 停止後續處理
}
```

這意味著所有頁面的 API 呼叫都有統一的登入過期處理，無需在每個頁面 JS 中個別處理 401。
