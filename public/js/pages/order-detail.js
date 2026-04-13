const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const el = document.getElementById('app');
    const orderId = el.dataset.orderId;
    const paymentResult = ref(el.dataset.paymentResult || null);

    const order = ref(null);
    const loading = ref(true);
    const confirming = ref(false);

    const statusMap = {
      pending: { label: '待付款', cls: 'bg-apricot/20 text-apricot' },
      paid: { label: '已付款', cls: 'bg-sage/20 text-sage' },
      failed: { label: '付款失敗', cls: 'bg-red-100 text-red-600' },
    };

    const paymentMessages = {
      success: { text: '付款成功！感謝您的購買。', cls: 'bg-sage/10 text-sage border border-sage/20' },
      failed: { text: '付款失敗，請重試。', cls: 'bg-red-50 text-red-600 border border-red-100' },
      cancel: { text: '付款已取消。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
    };

    // 綠界付款連結（附帶 JWT token 供後端驗證）
    const ecpayCheckoutUrl = computed(function () {
      const token = Auth.getToken();
      if (!order.value) return '#';
      return '/ecpay/checkout/' + order.value.id + '?token=' + encodeURIComponent(token || '');
    });

    async function confirmPayment() {
      if (confirming.value) return;
      confirming.value = true;
      try {
        const res = await apiFetch('/api/orders/' + orderId + '/ecpay-query', { method: 'POST' });
        if (res.data && res.data.status === 'paid') {
          // 重新載入訂單資料以反映最新狀態
          const updated = await apiFetch('/api/orders/' + orderId);
          order.value = updated.data;
          paymentResult.value = 'success';
        } else {
          Notification.show(res.message || '付款尚未完成', 'info');
        }
      } catch (e) {
        Notification.show(e?.data?.message || '查詢失敗，請稍後再試', 'error');
      } finally {
        confirming.value = false;
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/orders/' + orderId);
        order.value = res.data;
      } catch (e) {
        Notification.show('載入訂單失敗', 'error');
      } finally {
        loading.value = false;
      }
    });

    return {
      order, loading, confirming, paymentResult,
      statusMap, paymentMessages, ecpayCheckoutUrl, confirmPayment,
    };
  }
}).mount('#app');
