// เปลี่ยนเลขเวอร์ชันนี้ทุกครั้งที่อัปเดต index.html เพื่อให้เครื่องผู้ใช้โหลดของใหม่
const VERSION = "dm-v5";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    await Promise.all(CDN.map((u) => c.add(new Request(u, { mode: "no-cors" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // แผนที่/ค้นหาที่อยู่/Firebase: ไม่ยุ่ง ปล่อยให้เบราว์เซอร์ทำเอง
  if (url.hostname.endsWith("tile.openstreetmap.org") || url.hostname.includes("nominatim")) return;
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("firebaseio.com") || url.hostname.endsWith("firebaseapp.com")) return;

  // ไฟล์ตั้งค่า Firebase: เน็ตก่อนเสมอ เพื่อให้แก้ค่าแล้วมีผลทันที
  if (url.origin === location.origin && url.pathname.endsWith("firebase-config.js")) {
    e.respondWith((async () => {
      try { return await fetch(req); } catch (_) { return (await caches.match(req)) || Response.error(); }
    })());
    return;
  }

  // หน้าเว็บ: เน็ตก่อน ถ้าไม่มีเน็ตใช้ของที่เก็บไว้
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-cache" });
        const c = await caches.open(VERSION);
        c.put("./index.html", fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match("./index.html")) || (await caches.match("./"));
      }
    })());
    return;
  }

  // ไฟล์อื่น (ไลบรารี, ฟอนต์, ไอคอน): ใช้ที่เก็บไว้ก่อน แล้วอัปเดตเงียบๆ
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const net = fetch(req).then(async (res) => {
      if (res && (res.ok || res.type === "opaque")) {
        const c = await caches.open(VERSION);
        c.put(req, res.clone());
      }
      return res;
    }).catch(() => cached);
    return cached || net;
  })());
});
