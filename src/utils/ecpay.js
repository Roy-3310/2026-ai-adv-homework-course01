// Source: guides/13-checkmacvalue.md §Node.js + guides/01-payment-aio.md §QueryTradeInfo
const crypto = require('crypto');

const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const IS_STAGE = process.env.ECPAY_ENV !== 'production';
const ECPAY_BASE_URL = IS_STAGE
  ? 'https://payment-stage.ecpay.com.tw'
  : 'https://payment.ecpay.com.tw';

/**
 * ECPay 專用 URL encode
 * encodeURIComponent → %20→+ → ~→%7e → '→%27 → toLowerCase → .NET 字元替換
 * Source: guides/13 §Node.js
 */
function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const replacements = {
    '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!',
    '%2a': '*', '%28': '(', '%29': ')',
  };
  for (const [old, char] of Object.entries(replacements)) {
    encoded = encoded.split(old).join(char);
  }
  return encoded;
}

/**
 * 計算 CheckMacValue（SHA256）
 * Source: guides/13 §Node.js
 */
function generateCheckMacValue(params, hashKey, hashIv) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sorted = Object.keys(filtered)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIv}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

/**
 * timing-safe 驗證 CheckMacValue
 * Source: guides/13 §Node.js
 */
function verifyCheckMacValue(params, hashKey, hashIv) {
  const received = (params.CheckMacValue || '').toUpperCase();
  const calculated = generateCheckMacValue(params, hashKey, hashIv);
  const a = Buffer.from(received);
  const b = Buffer.from(calculated);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * 取得 UTC+8 格式時間 yyyy/MM/dd HH:mm:ss
 * Source: guides/lang-standards/nodejs.md §日期與時區
 */
function getMerchantTradeDate() {
  return new Date().toLocaleString('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).replace(/-/g, '/');
}

/**
 * 產生 ECPay 用的交易編號（最長 20 字元，僅英數字）
 * 格式：Unix 秒（10 碼）+ base36 隨機（10 碼）
 */
function generateEcpayTradeNo() {
  const ts = Math.floor(Date.now() / 1000).toString();
  const rand = Math.random().toString(36).replace('.', '').slice(2, 12).toUpperCase().padEnd(10, '0');
  return (ts + rand).slice(0, 20);
}

/**
 * 將訂單商品組成 ItemName（# 分隔，截斷至 200 字元內）
 * Source: guides/01 §首次串接快速路徑 — ItemName 超過 400 字元會掉單，建議 200 字元內
 */
function buildItemName(items) {
  const names = items.map(i => `${i.product_name} x${i.quantity}`).join('#');
  if (names.length <= 200) return names;
  // 安全截斷：避免截到 UTF-8 多位元組字元中間
  let result = '';
  for (const char of names) {
    if ((result + char).length > 197) break;
    result += char;
  }
  return result + '...';
}

/**
 * 呼叫 ECPay QueryTradeInfo/V5，回傳解析後的交易資料
 * Source: guides/01-payment-aio.md §查詢訂單
 * @returns {Promise<{TradeStatus: string, [key: string]: string}>}
 */
async function queryTradeInfo(merchantTradeNo) {
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: Math.floor(Date.now() / 1000).toString(), // ⚠️ 3 分鐘有效期
  };
  params.CheckMacValue = generateCheckMacValue(params, HASH_KEY, HASH_IV);

  const body = new URLSearchParams(params).toString();
  const response = await fetch(`${ECPAY_BASE_URL}/Cashier/QueryTradeInfo/V5`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`QueryTradeInfo HTTP ${response.status}`);
  }

  const text = await response.text();
  // 回應為 URL-encoded 字串
  const result = Object.fromEntries(new URLSearchParams(text));

  // 驗證回應的 CheckMacValue
  if (!verifyCheckMacValue(result, HASH_KEY, HASH_IV)) {
    throw new Error('QueryTradeInfo CheckMacValue 驗證失敗');
  }

  return result;
}

/**
 * 建立 AIO 付款所需的 HTML auto-submit form
 * 直接回傳 HTML 字串，由 route handler 送給瀏覽器
 */
function buildAioFormHtml(order) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const ecpayUrl = `${ECPAY_BASE_URL}/Cashier/AioCheckOut/V5`;

  const items = order.items || [];
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: order.ecpay_trade_no,
    MerchantTradeDate: getMerchantTradeDate(),
    PaymentType: 'aio',
    TotalAmount: order.total_amount,
    TradeDesc: '花卉電商訂單',
    ItemName: buildItemName(items),
    ReturnURL: `${baseUrl}/ecpay/return`,
    ClientBackURL: `${baseUrl}/orders/${order.id}?payment=return`,
    ChoosePayment: 'ALL',
    EncryptType: 1,
  };
  params.CheckMacValue = generateCheckMacValue(params, HASH_KEY, HASH_IV);

  const fields = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${escHtml(k)}" value="${escHtml(String(v))}">`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>跳轉至綠界付款...</title>
  <style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#555;}</style>
</head>
<body>
  <p>正在跳轉至綠界付款頁面，請稍候...</p>
  <form id="ecpay-form" action="${escHtml(ecpayUrl)}" method="POST">
    ${fields}
  </form>
  <script>document.getElementById('ecpay-form').submit();</script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  generateCheckMacValue,
  verifyCheckMacValue,
  generateEcpayTradeNo,
  queryTradeInfo,
  buildAioFormHtml,
};
