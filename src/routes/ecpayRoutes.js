const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const {
  generateEcpayTradeNo,
  verifyCheckMacValue,
  buildAioFormHtml,
} = require('../utils/ecpay');

const router = express.Router();

/**
 * GET /ecpay/checkout/:orderId
 * 產生綠界 AIO 付款表單並自動跳轉
 * 需要 JWT 認證（從 query string 或 cookie 取 token 不在此處，改用 header）
 *
 * 因為此路由由瀏覽器直接導向（<a> 連結），無法帶 Authorization header，
 * 故改從 query string ?token=... 取得 JWT。
 */
router.get('/checkout/:orderId', (req, res) => {
  // 從 query string 取 token（瀏覽器直接訪問時無法帶 header）
  const token = req.query.token;
  if (!token) {
    return res.status(401).send('請先登入');
  }

  let userId;
  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    userId = payload.userId;
  } catch (e) {
    return res.status(401).send('登入已過期，請重新登入');
  }

  const order = db.prepare(
    'SELECT * FROM orders WHERE id = ? AND user_id = ?'
  ).get(req.params.orderId, userId);

  if (!order) {
    return res.status(404).send('訂單不存在');
  }

  if (order.status !== 'pending') {
    return res.redirect(`/orders/${order.id}`);
  }

  // 產生或沿用 ecpay_trade_no
  let ecpayTradeNo = order.ecpay_trade_no;
  if (!ecpayTradeNo) {
    ecpayTradeNo = generateEcpayTradeNo();
    db.prepare('UPDATE orders SET ecpay_trade_no = ? WHERE id = ?').run(ecpayTradeNo, order.id);
  }

  // 讀取訂單商品（buildAioFormHtml 需要 items）
  const items = db.prepare(
    'SELECT product_name, product_price, quantity FROM order_items WHERE order_id = ?'
  ).all(order.id);

  const orderWithItems = { ...order, ecpay_trade_no: ecpayTradeNo, items };
  const html = buildAioFormHtml(orderWithItems);
  res.send(html);
});

/**
 * POST /ecpay/return
 * ReturnURL handler（本機通常收不到，但保留正確實作供 ngrok 測試使用）
 * Source: guides/01-payment-aio.md §步驟 3，Node.js 範例
 */
router.post('/return', (req, res) => {
  const params = { ...req.body };

  // 驗證 CheckMacValue（timing-safe）
  if (!verifyCheckMacValue(params, process.env.ECPAY_HASH_KEY, process.env.ECPAY_HASH_IV)) {
    console.error('[ECPay ReturnURL] CheckMacValue 驗證失敗');
    // ⚠️ 仍需回 1|OK + HTTP 200，否則 ECPay 會重試最多 4 次
    return res.status(200).type('text/plain').send('1|OK');
  }

  // ⚠️ AIO RtnCode 是字串 '1'
  if (params.RtnCode === '1') {
    const merchantTradeNo = params.MerchantTradeNo;
    const order = db.prepare(
      'SELECT * FROM orders WHERE ecpay_trade_no = ?'
    ).get(merchantTradeNo);

    if (order && order.status === 'pending') {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', order.id);
      console.log(`[ECPay ReturnURL] 付款成功 orderId=${order.id}`);
    }
  }

  // ⚠️ 必須回應純文字 1|OK，HTTP 200
  res.status(200).type('text/plain').send('1|OK');
});

module.exports = router;
