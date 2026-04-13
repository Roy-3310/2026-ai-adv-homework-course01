# ECPay 金流整合計畫

## Context

本專案為本地端花卉電商網站，無法接收綠界的 Server-to-Server 回呼（ReturnURL 設為本機 URL，綠界無法連入）。因此付款確認改為**使用者主動觸發**，由後端呼叫綠界 `QueryTradeInfo` API 主動查詢交易狀態。

付款方式：`ChoosePayment=ALL`（讓消費者在綠界頁面自選信用卡、ATM、超商代碼等）

---

## 整合架構

```
使用者                     我方後端                     綠界
  │                           │                           │
  ├─ GET /ecpay/checkout/:id ─→│                           │
  │                           ├─ 產生 MerchantTradeNo      │
  │                           ├─ 儲存至 DB                 │
  │                           ├─ 產生含 CMV 的 HTML Form ──→│ POST AioCheckOut/V5
  │ ←─ 自動跳轉付款頁 ─────────│←─ HTML auto-submit        │
  │                           │                           │
  ├─ 在綠界完成付款 ───────────────────────────────────────→│
  │                           │        (ReturnURL=本機，綠界無法觸達，正常)
  │ ←─ ClientBackURL 導回 ────│←── 瀏覽器導回             │
  │   /orders/:id?payment=return                          │
  │                           │                           │
  ├─ 點「確認付款結果」──────────→│                           │
  │                           ├─ POST QueryTradeInfo/V5 ──→│
  │                           │←─ URL-encoded 回應 ────────│
  │                           ├─ 驗證 CheckMacValue        │
  │ ←─ 訂單狀態更新 ───────────│ (TradeStatus='1' → paid)  │
```

---

## 需要修改 / 新增的檔案

### 1. `src/utils/ecpay.js`（新增）
ECPay 工具模組，包含：
- `ecpayUrlEncode(source)` — ECPay 專用 URL encode（encodeURIComponent → %20→+ → ~→%7e → '→%27 → toLowerCase → .NET 字元替換）
- `generateCheckMacValue(params, hashKey, hashIv)` — SHA256 CheckMacValue 計算
- `verifyCheckMacValue(params, hashKey, hashIv)` — timing-safe 驗證（crypto.timingSafeEqual）
- `getMerchantTradeDate()` — 取得 UTC+8 格式時間 `yyyy/MM/dd HH:mm:ss`
- `generateEcpayTradeNo()` — 產生 20 字元以內純英數字交易編號（Unix 秒 10碼 + 隨機 10 碼，取前 20）
- `buildItemName(items)` — 將 order_items 組成 ItemName，截斷至 200 字元內（防止 ECPay 截斷導致 CMV 不符）
- `queryTradeInfo(merchantTradeNo)` — 呼叫 QueryTradeInfo/V5，Parse URL-encoded 回應，驗證 CMV，回傳 `{ TradeStatus, ... }`

**環境變數使用：** `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`, `ECPAY_ENV`, `BASE_URL`

### 2. `src/routes/ecpayRoutes.js`（新增）
兩個路由：

**`GET /ecpay/checkout/:orderId`**（需 JWT 認證）
- 從 DB 讀取訂單（確認屬於當前使用者且狀態為 `pending`）
- 若 `ecpay_trade_no` 為 null → 產生新的 MerchantTradeNo，UPDATE 至 DB
- 若已有 `ecpay_trade_no` → 沿用（允許重新付款）
- 建立 AIO 付款參數（含 `ReturnURL`, `ClientBackURL`, `ChoosePayment=ALL`）
- 計算 CheckMacValue
- 直接回傳 HTML（含自動 submit 的 form），瀏覽器跳轉至綠界

**`POST /ecpay/return`**（ReturnURL handler，本機通常收不到，但保留正確實作）
- 解析 urlencoded body
- 驗證 CheckMacValue
- 若 `RtnCode === '1'` → 由 `MerchantTradeNo` 找到訂單，更新 status 為 `paid`
- 回應純文字 `1|OK`，HTTP 200

### 3. `src/database.js`（修改）
在現有 `orders` 表的初始化後，新增 migration：
```js
try {
  db.exec('ALTER TABLE orders ADD COLUMN ecpay_trade_no TEXT');
} catch (_) { /* 欄位已存在，忽略 */ }
```

### 4. `app.js`（修改）
在既有路由之後，掛載 ECPay 路由：
```js
app.use('/ecpay', require('./src/routes/ecpayRoutes'));
```
注意：`/ecpay/return` 需接收 urlencoded body（app.js 已有 `express.urlencoded`，無需額外設定）

### 5. `src/routes/orderRoutes.js`（修改）
新增端點 `POST /api/orders/:id/ecpay-query`（需 JWT）：
- 讀取訂單，確認屬於當前使用者
- 若 `status !== 'pending'` → 400（已非待付款）
- 若 `ecpay_trade_no` 為 null → 400（尚未發起綠界付款）
- 呼叫 `queryTradeInfo(order.ecpay_trade_no)`
- `TradeStatus === '1'` → UPDATE status=`paid`，回傳 `{status:'paid', message:'付款已確認'}`
- `TradeStatus === '0'` → 回傳 `{status:'pending', message:'付款尚未完成'}`
- 其他 TradeStatus / 錯誤 → 回傳 `{status:'pending', message:'查詢失敗，請稍後再試'}`

### 6. `views/pages/order-detail.ejs`（修改）
將目前「付款成功 / 付款失敗」按鈕區塊替換為：
```html
<!-- 當 order.status === 'pending' -->
<div v-if="order.status === 'pending'" class="flex gap-4">
  <a :href="'/ecpay/checkout/' + order.id"
     class="bg-rose-primary text-white px-8 py-3 rounded-full ...">
    前往綠界付款
  </a>
  <button v-if="paymentResult === 'return'"
          @click="confirmPayment" :disabled="confirming"
          class="bg-sage text-white px-8 py-3 rounded-full ...">
    {{ confirming ? '查詢中...' : '確認付款結果' }}
  </button>
</div>
```
新增 `paymentMessages.return`：`{ text: '已從付款頁返回，請點擊「確認付款結果」確認狀態。', cls: 'bg-apricot/10...' }`

### 7. `public/js/pages/order-detail.js`（修改）
移除 `handlePaySuccess`, `handlePayFail`, `simulatePay` 函式，新增：
```js
const confirming = ref(false);

async function confirmPayment() {
  if (confirming.value) return;
  confirming.value = true;
  try {
    const res = await apiFetch('/api/orders/' + orderId + '/ecpay-query', { method: 'POST' });
    // 重新載入訂單資料
    const updated = await apiFetch('/api/orders/' + orderId);
    order.value = updated.data;
    if (res.data.status === 'paid') {
      paymentResult.value = 'success';
    } else {
      Notification.show(res.message || '付款尚未完成', 'info');
    }
  } catch (e) {
    Notification.show('查詢失敗，請稍後再試', 'error');
  } finally {
    confirming.value = false;
  }
}
```
回傳的 reactive state 加入 `confirming`, `confirmPayment`，移除 `handlePaySuccess`, `handlePayFail`, `paying`。

---

## ECPay AIO 付款參數（ChoosePayment=ALL）

```
MerchantID         = process.env.ECPAY_MERCHANT_ID
MerchantTradeNo    = order.ecpay_trade_no（最長 20 字元英數）
MerchantTradeDate  = UTC+8 "yyyy/MM/dd HH:mm:ss"
PaymentType        = aio
TotalAmount        = order.total_amount（整數，不含運費*）
TradeDesc          = 花卉訂單
ItemName           = 以 # 分隔商品名稱，截斷至 200 字元
ReturnURL          = ${BASE_URL}/ecpay/return（本機，綠界通常觸達不到）
ClientBackURL      = ${BASE_URL}/orders/${order.id}?payment=return
ChoosePayment      = ALL
EncryptType        = 1
CheckMacValue      = [SHA256 計算]
```

*`total_amount` 為商品金額（不含運費），運費邏輯在前端顯示，目前訂單表僅存商品總額。保持一致以避免金額不符。

**ECPay 測試環境 URL：** `https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5`
**QueryTradeInfo URL：** `https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5`

---

## 驗證方式

1. 啟動開發伺服器：`npm run dev:server`
2. 登入 → 加商品至購物車 → 結帳建立訂單
3. 在訂單詳情頁點「前往綠界付款」→ 確認跳轉至 `payment-stage.ecpay.com.tw`
4. 使用測試信用卡 `4311-9522-2222-2222`，CVV 任意三碼，3DS 驗證碼 `1234`
5. 付款完成後確認瀏覽器導回 `/orders/:id?payment=return`
6. 點「確認付款結果」→ 確認訂單狀態變為「已付款」
7. 測試 ATM/超商：選 ATM 或超商代碼完成取號 → 返回後點「確認付款結果」（因測試環境尚未繳費，TradeStatus=0，應顯示「付款尚未完成」）
