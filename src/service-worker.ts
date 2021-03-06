// @ts-nocheck
// /// <reference lib="webworker" />
/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals, no-restricted-syntax, security/detect-non-literal-fs-filename, no-void */

// @ts-expect-error - no included types
import { files, shell, timestamp } from '@sapper/service-worker'; // eslint-disable-line import/no-extraneous-dependencies

const ASSETS = `cache${timestamp}`;

// `shell` is an array of all the files generated by the bundler,
// `files` is an array of everything in the `static` directory
const toCache = shell.concat(files);
const staticAssets = new Set(toCache);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(ASSETS)
      .then((cache) => cache.addAll(toCache))
      .then(() => {
        self.skipWaiting();
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      // delete old caches
      for (const key of keys) {
        // eslint-disable-next-line no-await-in-loop
        if (key !== ASSETS) await caches.delete(key);
      }

      self.clients.claim();
    }),
  );
});

/**
 * Fetch the asset from the network and store it in the cache.
 * Fall back to the cache if the user is offline.
 */
async function fetchAndCache(request): Promise<Response> {
  const cache = await caches.open(`offline${timestamp}`);

  try {
    const response = await fetch(request);
    void cache.put(request, response.clone());
    return response;
  } catch (err) {
    const response = await cache.match(request);
    if (response) return response;

    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.headers.has('range')) {
    return;
  }

  const url = new URL(event.request.url);

  // don't try to handle e.g. data: URIs
  const isHttp = url.protocol.startsWith('http');
  const isDevServerRequest =
    url.hostname === self.location.hostname && url.port !== self.location.port;
  const isStaticAsset =
    url.host === self.location.host && staticAssets.has(url.pathname);
  const skipBecauseUncached =
    event.request.cache === 'only-if-cached' && !isStaticAsset;

  if (isHttp && !isDevServerRequest && !skipBecauseUncached) {
    event.respondWith(
      (async () => {
        // always serve static files and bundler-generated assets from cache.
        // if your application has other URLs with data that will never change,
        // set this variable to true for them and they will only be fetched once
        const cachedAsset =
          isStaticAsset && (await caches.match(event.request));

        // for pages, you might want to serve a shell
        // `service-worker-index.html` file, which Sapper has generated for
        // you. It's not right for every app, but if it's right for yours then
        // uncomment this section
        /*
        if (
          !cachedAsset &&
          url.origin === self.origin &&
          routes.find((route) => route.pattern.test(url.pathname))
        ) {
          return caches.match('/service-worker-index.html');
        }
        */

        return cachedAsset || fetchAndCache(event.request);
      })(),
    );
  }
});
