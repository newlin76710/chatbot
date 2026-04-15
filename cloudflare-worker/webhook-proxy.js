/**
 * BotFlow LINE Webhook Proxy — Cloudflare Worker
 *
 * 部署步驟：
 *   1. 到 Cloudflare Workers 新增一個 Worker，把這段程式碼貼進去
 *   2. 在 Worker 的「設定 → 變數」加入環境變數：
 *        BACKEND_URL = https://你的後端位址   （例如 ngrok 給的 URL）
 *   3. 把 LINE Developer Console 的 Webhook URL 設為：
 *        https://你的worker名稱.你的帳號.workers.dev/webhook/line/<channelId>
 *
 * 之後後端位址變了（例如 ngrok 重啟），只要在 Cloudflare 更新 BACKEND_URL 即可，
 * LINE Console 的 Webhook URL 不需要改。
 */

export default {
  async fetch(request, env) {
    const BACKEND_URL = env.BACKEND_URL;

    if (!BACKEND_URL) {
      return new Response(
        JSON.stringify({ error: '請在 Worker 環境變數設定 BACKEND_URL' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);

    // 只轉發 webhook 路徑（/webhook/*），其他路徑回 404
    if (!url.pathname.startsWith('/webhook/')) {
      return new Response('Not Found', { status: 404 });
    }

    const targetUrl = BACKEND_URL.replace(/\/$/, '') + url.pathname + url.search;

    // 複製 headers，去掉 Host（讓後端用自己的 Host）
    const headers = new Headers(request.headers);
    headers.delete('host');

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
        // 不要讓 CF 自動解壓縮，保持原始 body（LINE 簽章驗證需要）
        redirect: 'follow',
      });

      // 把後端的回應原封不動轉回給 LINE
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });

    } catch (err) {
      console.error('轉發失敗:', err.message);
      return new Response(
        JSON.stringify({ error: '後端無法連線', detail: err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
