# 測試規範與指南 (TESTING.md)

## 測試框架與工具

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | ^2.1.9 | 測試框架（執行、斷言、測試報告） |
| supertest | ^7.2.2 | HTTP 請求模擬（對 Express app 發送 API 請求） |

---

## 測試設定（vitest.config.js）

```javascript
{
  test: {
    globals: true,           // 啟用全域 describe/it/expect，無需 import
    fileParallelism: false,  // 禁止測試檔案平行執行（序列）
    sequence: {
      files: [               // 固定執行順序
        'tests/auth.test.js',
        'tests/products.test.js',
        'tests/cart.test.js',
        'tests/orders.test.js',
        'tests/adminProducts.test.js',
        'tests/adminOrders.test.js'
      ]
    },
    hookTimeout: 10000       // beforeAll/afterAll 超時 10 秒
  }
}
```

### 為何禁止平行執行？

所有測試共用同一個 SQLite 資料庫（`database.sqlite`）。若平行執行，多個測試同時讀寫同一份資料會產生競爭條件（race condition），導致測試結果不確定。

### 為何順序固定？

測試之間存在**資料依賴**：

```
auth.test.js         → 建立測試用戶帳號（後續測試使用）
products.test.js     → 讀取種子商品（tests 需商品存在）
cart.test.js         → 加入商品到購物車（orders.test 需購物車有資料）
orders.test.js       → 從購物車建立訂單（adminOrders.test 需訂單存在）
adminProducts.test.js → 測試後台商品管理
adminOrders.test.js  → 測試後台訂單管理（依賴 orders.test 建立的訂單）
```

---

## 測試檔案說明

### tests/setup.js — 共用助手

所有測試檔案都 `require('./setup')` 取得：

```javascript
// 取得 supertest 請求物件
const { request, app } = require('./setup');

// 取得管理員 Token
const { getAdminToken } = require('./setup');
const adminToken = await getAdminToken();

// 建立測試用戶（隨機 Email，避免衝突）
const { registerUser } = require('./setup');
const { token, user } = await registerUser();

// 帶自訂覆寫欄位
const { token, user } = await registerUser({ 
  email: 'custom@test.com',
  name: '測試用戶'
});
```

**`getAdminToken()`**：以 `admin@hexschool.com`（或 `ADMIN_EMAIL`）登入，回傳 JWT Token。若管理員不存在（如測試環境 DB 未初始化），測試會失敗。

**`registerUser(overrides)`**：以隨機 UUID 為 Email 前綴建立測試用戶，確保每次測試都使用獨立帳號，避免 Email 衝突。

### 測試檔案總覽

| 檔案 | 測試 API | 測試重點 |
|------|---------|---------|
| `auth.test.js` | `/api/auth/*` | 註冊、登入、個人資料、401 驗證 |
| `products.test.js` | `/api/products/*` | 商品列表、分頁、詳情、404 |
| `cart.test.js` | `/api/cart/*` | 遊客模式（Session）、登入模式（JWT）、CRUD |
| `orders.test.js` | `/api/orders/*` | 建立訂單、列表、詳情、空購物車錯誤、401 |
| `adminProducts.test.js` | `/api/admin/products/*` | CRUD、403 權限拒絕 |
| `adminOrders.test.js` | `/api/admin/orders/*` | 列表（含狀態篩選）、詳情、403 |

---

## 測試涵蓋清單

### auth.test.js

- ✅ `POST /api/auth/register` — 新用戶成功註冊，回傳 token 和 user
- ✅ `POST /api/auth/register` — 重複 Email 返回 409
- ✅ `POST /api/auth/login` — 正確帳密成功登入
- ✅ `POST /api/auth/login` — 錯誤密碼返回 401
- ✅ `GET /api/auth/profile` — 有效 token 返回用戶資料
- ✅ `GET /api/auth/profile` — 無 token 返回 401

### products.test.js

- ✅ `GET /api/products` — 返回商品列表與 pagination
- ✅ `GET /api/products?page=1&limit=5` — 分頁參數生效
- ✅ `GET /api/products/:id` — 返回單一商品詳情
- ✅ `GET /api/products/non-existent-id` — 返回 404

### cart.test.js

- ✅ 遊客模式：`POST /api/cart`（X-Session-Id header）
- ✅ 遊客模式：`GET /api/cart`（取得剛加入的商品）
- ✅ 遊客模式：`PATCH /api/cart/:itemId`（更新數量）
- ✅ 遊客模式：`DELETE /api/cart/:itemId`（移除商品）
- ✅ 登入模式：`POST /api/cart`（JWT Authorization）
- ✅ 登入模式：`GET /api/cart`（取得購物車，驗證 total 計算）
- ✅ 商品不存在：`POST /api/cart` 返回 404

### orders.test.js

- ✅ `POST /api/orders` — 從購物車成功建立訂單，驗證回傳 order_no、items
- ✅ `POST /api/orders` — 購物車為空返回 400
- ✅ `POST /api/orders` — 無 token 返回 401
- ✅ `GET /api/orders` — 返回當前用戶訂單列表
- ✅ `GET /api/orders/:id` — 返回訂單詳情（含 items）
- ✅ `GET /api/orders/:id` — 不存在的訂單返回 404

### adminProducts.test.js

- ✅ `GET /api/admin/products` — 管理員取得商品列表
- ✅ `POST /api/admin/products` — 管理員新增商品
- ✅ `PUT /api/admin/products/:id` — 管理員編輯商品
- ✅ `DELETE /api/admin/products/:id` — 管理員刪除商品
- ✅ 一般用戶存取返回 403
- ✅ 未登入存取返回 401

### adminOrders.test.js

- ✅ `GET /api/admin/orders` — 管理員取得所有訂單
- ✅ `GET /api/admin/orders?status=pending` — 依狀態篩選訂單
- ✅ `GET /api/admin/orders/:id` — 取得訂單詳情（含 user 欄位）
- ✅ 一般用戶存取返回 403

---

## 執行測試

```bash
# 執行所有測試（序列，按 vitest.config.js 定義的順序）
npm test

# 執行特定測試檔案
npx vitest run tests/auth.test.js

# 監聽模式（開發時自動重跑）
npx vitest watch

# 顯示詳細輸出
npx vitest run --reporter=verbose
```

---

## 撰寫新測試的步驟

### 步驟 1：建立測試檔案

```javascript
// tests/reviews.test.js
const { request, registerUser, getAdminToken } = require('./setup');

describe('Reviews API', () => {
  let userToken;
  let testProductId;

  // beforeAll 只執行一次，初始化共用資源
  beforeAll(async () => {
    const { token } = await registerUser();
    userToken = token;

    // 取得一個商品 ID 用於測試
    const res = await request.get('/api/products');
    testProductId = res.body.data.products[0].id;
  });

  describe('POST /api/reviews', () => {
    it('應成功新增評論', async () => {
      const res = await request
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: testProductId,
          content: '很棒的商品！',
          rating: 5
        });

      expect(res.status).toBe(201);
      expect(res.body.error).toBeNull();
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.content).toBe('很棒的商品！');
    });

    it('未登入應返回 401', async () => {
      const res = await request
        .post('/api/reviews')
        .send({ productId: testProductId, content: '...', rating: 5 });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('rating 超出範圍應返回 400', async () => {
      const res = await request
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: testProductId, content: '...', rating: 6 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });
});
```

### 步驟 2：在 vitest.config.js 加入新測試檔案

```javascript
// vitest.config.js
sequence: {
  files: [
    'tests/auth.test.js',
    'tests/products.test.js',
    'tests/cart.test.js',
    'tests/orders.test.js',
    'tests/adminProducts.test.js',
    'tests/adminOrders.test.js',
    'tests/reviews.test.js'    // ← 加入新檔案（放在最後或適當位置）
  ]
}
```

### 步驟 3：驗證測試通過

```bash
npm test
```

---

## 測試常見陷阱

### 陷阱 1：測試之間共用資料庫狀態

**問題**：某個測試刪除了種子商品，後續測試找不到商品而失敗。

**解決**：
- 測試只建立自己的資料，不刪除種子數據
- 若需要刪除，在 `afterAll` 中清理，並只清理該測試建立的資料

```javascript
describe('Admin Products', () => {
  let createdProductId;

  it('新增商品', async () => {
    const res = await request.post('/api/admin/products')...;
    createdProductId = res.body.data.id;  // 記錄建立的 ID
  });

  afterAll(async () => {
    // 清理：只刪除本測試建立的商品
    if (createdProductId) {
      await request
        .delete(`/api/admin/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });
});
```

### 陷阱 2：遊客購物車與登入購物車混用

**問題**：同一個測試既用 Session ID 又用 JWT 存取購物車，導致看到不同資料。

**解決**：每個 `describe` 使用獨立的 session ID：

```javascript
describe('遊客購物車', () => {
  const sessionId = `test-session-${Date.now()}`;  // 唯一 session ID

  it('加入購物車', async () => {
    await request
      .post('/api/cart')
      .set('X-Session-Id', sessionId)  // 只用 Session，不帶 JWT
      .send({ productId: '...', quantity: 1 });
  });
});
```

### 陷阱 3：測試用 Email 衝突

**問題**：多個測試用相同 Email 註冊，第二次返回 409。

**解決**：使用 `registerUser()` 輔助函式，它使用隨機 UUID 作為 Email 前綴：

```javascript
// 錯誤：固定 Email
const res = await request.post('/api/auth/register').send({
  email: 'test@test.com',   // ❌ 多次執行會衝突
  ...
});

// 正確：使用 registerUser() 輔助函式
const { token, user } = await registerUser();  // ✅ 每次都是唯一 Email
```

### 陷阱 4：訂單測試需要購物車有資料

**問題**：`POST /api/orders` 在購物車為空時返回 400，若沒有先加入購物車，訂單測試必然失敗。

**解決**：在 `orders.test.js` 的 `beforeAll` 中先加入商品到購物車：

```javascript
beforeAll(async () => {
  const { token, user } = await registerUser();
  userToken = token;

  // 取得商品
  const productsRes = await request.get('/api/products');
  const product = productsRes.body.data.products[0];

  // 加入購物車
  await request
    .post('/api/cart')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ productId: product.id, quantity: 1 });
});
```

### 陷阱 5：遊客購物車 Session ID 需要隨機產生

**問題**：使用固定 Session ID 在多次測試中會累積購物車資料，影響數量驗證。

**解決**：每個測試 suite 使用 `uuid` 產生唯一 Session：

```javascript
const { v4: uuidv4 } = require('uuid');
const sessionId = uuidv4();  // 確保每次測試 suite 使用全新的 session
```

---

## 測試 Helper 函式參考

### `request`

```javascript
// supertest 包裝的 Express app，直接發送 HTTP 請求
const { request } = require('./setup');

await request.get('/api/products');
await request.post('/api/auth/login').send({ email: '...', password: '...' });
await request.patch('/api/cart/item-id').set('Authorization', `Bearer ${token}`).send({ quantity: 3 });
```

### `getAdminToken()`

```javascript
const { getAdminToken } = require('./setup');
const adminToken = await getAdminToken();
// 回傳字串 JWT Token
// 若管理員不存在（環境問題），會拋出錯誤
```

### `registerUser(overrides?)`

```javascript
const { registerUser } = require('./setup');

// 使用隨機 Email
const { token, user } = await registerUser();

// 自訂欄位
const { token, user } = await registerUser({
  email: 'specific@example.com',
  name: '指定名稱'
  // password 不建議覆寫，預設為固定測試密碼
});

// 回傳值
// token: string JWT Token
// user: { id, email, name, role }
```
