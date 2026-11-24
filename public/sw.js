/* CSGM 서비스 워커: 앱 설치(홈 화면) + 휴대폰 알림.
 * 화면 파일은 저장해 두지 않는다(항상 최신 화면). 인터넷이 끊겼을 때만 안내 쪽을 보여 준다. */
const OFFLINE_HTML = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>연결 없음</title><body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#F2F4F6;color:#111827">
<div style="text-align:center;padding:24px"><div style="font-size:44px">📶</div><h1 style="font-size:20px">인터넷에 연결되어 있지 않아요</h1>
<p style="color:#6b7280">연결되면 다시 시도해 주세요.</p><button onclick="location.reload()" style="margin-top:12px;padding:12px 20px;border:0;border-radius:999px;background:#3182F6;color:#fff;font-size:15px">다시 시도</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});

self.addEventListener("push", (e) => {
  let msg = { title: "CSGM", body: "", url: "/" };
  try { msg = { ...msg, ...e.data.json() }; } catch { if (e.data) msg.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: msg.tag,
    renotify: !!msg.tag,
    data: { url: msg.url || "/" },
    lang: "ko",
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        if ("navigate" in w) return w.navigate(url);
        return;
      }
    }
    return self.clients.openWindow(url);
  })());
});
