// オフライン用のサービスワーカー。
//
// 自分のファイルは network-first（つながっていれば常に最新、圏外なら保存しておいた版）。
// three.js（jsDelivr）と Google Fonts は版が固定で変わらないので cache-first。
// three.js はインストール時に先に取っておき、初回のあと圏外になっても立方体が描けるようにする。
//
// 注意: キャッシュ（CacheStorage）は sora3141.github.io のすべてのアプリで共有されている。
// 古いキャッシュを消すときは、必ず自分の PREFIX で始まるものだけを消す。
// keys.filter(k => k !== CACHE) のように書くと、ほかのアプリのキャッシュまで消してしまう。

const PREFIX = 'cube-othello-';
const VERSION = 'v1';
const CACHE = `${PREFIX}${VERSION}`;
const LIB_CACHE = `${PREFIX}lib`;     // three.js。index.html の importmap と版をそろえる
const FONT_CACHE = `${PREFIX}fonts`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './webapp-kit/webapp-kit.css',
  './webapp-kit/webapp-kit.js',
  './icons/icon.svg',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

const THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const LIBS = [
  `${THREE}build/three.module.js`,
  `${THREE}examples/jsm/geometries/RoundedBoxGeometry.js`,
  `${THREE}examples/jsm/environments/RoomEnvironment.js`,
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap';

self.addEventListener('install', (e) => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then((c) => c.addAll(SHELL)),
    caches.open(LIB_CACHE).then((c) => c.addAll(LIBS)),
    // フォントは取れなくても遊べる（端末のフォントで表示される）
    caches.open(FONT_CACHE).then((c) => c.add(FONT_CSS)).catch(() => {}),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys
      .filter((k) => k.startsWith(PREFIX) && k !== CACHE && k !== LIB_CACHE && k !== FONT_CACHE)
      .map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(networkFirst(req));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(cacheFirst(req, LIB_CACHE));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req, FONT_CACHE));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
