import { getApiBaseUrl } from './backendUrl.js';

// Readable URLs. A bare /<resource>/<uuid> (admin or agent) shows up in the network
// tab as an opaque id, so a request for a single resource gets its name
// appended: /departures/<uuid>/goa-4n-getaway. The backend strips that
// last segment before routing (middleware/readablePath.js), so it is purely
// cosmetic. Names are learned from the id+title/name pairs in earlier
// responses, so call sites don't have to pass anything.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READABLE_TARGET = /^(\/[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*){0,2}\/)([0-9a-f-]{36})$/i;
// Sub-route names a slug must never equal (the backend also checks this).
const RESERVED_SLUGS = new Set([
  'images', 'hero-image', 'itinerary', 'documents', 'addons', 'messages', 'read', 'seen',
  'respond', 'publish', 'submit', 'review', 'costing', 'data', 'voucher', 'abort', 'enquire',
  'bookings', 'departure-dates', 'delete-impact', 'lead-manager', 'itinerary-print-token',
]);
// Resources whose responses have no title/name to learn one from.
const FALLBACK_NAMES = { payments: 'payment' };
const nameById = new Map();

function toSlug(value) {
  const slug = String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  if (!slug) return '';
  return RESERVED_SLUGS.has(slug) ? `${slug}-details` : slug;
}

function learnNames(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 4) return;
  if (Array.isArray(node)) {
    for (const item of node.slice(0, 500)) learnNames(item, depth + 1);
    return;
  }
  const label = node.title || node.name || node.packageTitle || node.packageName || node.agencyName || node.companyName;
  if (typeof node.id === 'string' && UUID_RE.test(node.id) && typeof label === 'string') {
    const slug = toSlug(label);
    if (slug) nameById.set(node.id.toLowerCase(), slug);
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') learnNames(value, depth + 1);
  }
}

export function readablePath(path) {
  const queryAt = path.indexOf('?');
  const pathname = queryAt === -1 ? path : path.slice(0, queryAt);
  const m = pathname.match(READABLE_TARGET);
  if (!m) return path;
  // Payments carry no title of their own, so they read /payments/<id>/payment.
  const slug = nameById.get(m[2].toLowerCase()) || FALLBACK_NAMES[m[1].split('/').filter(Boolean).pop()];
  if (!slug) return path;
  return `${pathname}/${slug}${queryAt === -1 ? '' : path.slice(queryAt)}`;
}

// Factory instead of a module-level singleton: the agent and admin modules each
// instantiate their own client so their access tokens and 401 handlers stay
// isolated even though they now live in the same JS bundle (see AUTH-7 in
// context/AuthContext.jsx — /agent and /admin are fully separate auth contexts).
export function createApiClient() {
  // Direct cross-origin call to the backend (https://backend.xclusiveoman.com/api)
  // — there is no same-origin Apache/Vercel proxy in front of it anymore. The
  // httpOnly refresh cookie (xo_refresh, auth.controller.js) is issued with
  // SameSite=None; Secure in production specifically so it still rides along
  // on this cross-site fetch (see refreshCookieOptions in the backend's
  // auth.controller.js) — a plain 'lax'/same-origin cookie would be dropped.
  const BASE_URL = getApiBaseUrl();

  let accessToken = null;
  let onUnauthorized = null;

  function setAccessToken(token) {
    accessToken = token;
  }

  function getAccessToken() {
    return accessToken;
  }

  // Called by AuthContext once, so a hard 401 (refresh also failed) can clear
  // client state without this module needing to import React.
  function setUnauthorizedHandler(handler) {
    onUnauthorized = handler;
  }

  async function rawRequest(path, { method = 'GET', body, skipAuth = false } = {}) {
    const isFormData = body instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    if (!skipAuth && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${BASE_URL}${readablePath(path)}`, {
      method,
      headers,
      credentials: 'include', // sends the httpOnly refresh cookie
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    let invalidJson = false;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // A 200 with an HTML/plain-text body (misrouted request, host error
        // page, etc.) must not be treated as "success with no data" — that
        // silently produced `data: null` here before, which callers then read
        // straight through with `data.someField` and crashed several layers
        // away with an unrelated-looking "Cannot read properties of null".
        invalidJson = true;
      }
    }
    if (res.ok && data) learnNames(data);

    return { ok: res.ok, status: res.status, data, invalidJson };
  }

  async function tryRefresh() {
    const { ok, data } = await rawRequest('/auth/refresh', { method: 'POST', skipAuth: true });
    if (ok && data?.accessToken) {
      setAccessToken(data.accessToken);
      return true;
    }
    return false;
  }

  /**
   * Main request helper. On a 401 (expired access token) it makes one attempt
   * to refresh via the httpOnly cookie and retries the original call before
   * giving up and notifying AuthContext.
   */
  async function apiRequest(path, options = {}) {
    let result = await rawRequest(path, options);

    if (result.status === 401 && !options.skipAuth && !options._retried) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        result = await rawRequest(path, options);
      } else {
        onUnauthorized?.();
      }
    }

    if (!result.ok) {
      const message = result.invalidJson
        ? `Server returned an invalid response (status ${result.status})`
        : result.data?.message || result.data?.error || `Request failed (${result.status})`;
      const error = new Error(message);
      error.status = result.status;
      error.data = result.data;
      throw error;
    }

    // A 2xx status with a body that isn't valid JSON means something upstream
    // of the API (a proxy, a host error page) intercepted the request — treat
    // it as a failure rather than handing callers `data: null` to destructure.
    if (result.invalidJson) {
      const error = new Error('Server returned an unexpected non-JSON response');
      error.status = result.status;
      throw error;
    }

    return result.data;
  }

  // Binary downloads (PDF export etc.) — same Authorization header + one
  // refresh-and-retry-on-401 contract as apiRequest above, but the response
  // body is a Blob rather than parsed JSON, so it can't share that function's
  // JSON-parsing return path. Error responses are still JSON ({error,
  // message}) even though a success response is binary, so those are parsed
  // for the message the same way apiRequest does.
  async function rawBlobRequest(path, { method = 'GET' } = {}) {
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${BASE_URL}${path}`, { method, headers, credentials: 'include' });
  }

  // Shared by getBlob/getBlobWithFilename below — the 401-retry + error-JSON
  // parsing is identical either way, only what happens with a *successful*
  // response differs (one just wants the Blob, the other also wants the
  // filename the server chose).
  async function resolveBlobResponse(path, options = {}) {
    let res = await rawBlobRequest(path, options);

    if (res.status === 401 && !options._retried) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        res = await rawBlobRequest(path, { ...options, _retried: true });
      } else {
        onUnauthorized?.();
      }
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        message = data?.message || data?.error || message;
      } catch {
        // Response body wasn't JSON — keep the generic status message.
      }
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

    return res;
  }

  async function apiBlobRequest(path, options = {}) {
    const res = await resolveBlobResponse(path, options);
    return res.blob();
  }

  // Every document-download endpoint here (traveler documents, vouchers)
  // already sets a correctly-named, correctly-extensioned Content-Disposition
  // header server-side — this reads that back instead of making callers
  // reconstruct a filename client-side (which is exactly how
  // shared/documents/downloadDocument.js's callers used to end up saving
  // files with no extension at all, since they never had the real one).
  const CONTENT_DISPOSITION_FILENAME_RE = /filename="?([^";]+)"?/i;
  async function apiBlobRequestWithFilename(path, options = {}) {
    const res = await resolveBlobResponse(path, options);
    const disposition = res.headers.get('content-disposition');
    const match = disposition?.match(CONTENT_DISPOSITION_FILENAME_RE);
    return { blob: await res.blob(), filename: match?.[1]?.trim() || null };
  }

  const api = {
    get: (path) => apiRequest(path, { method: 'GET' }),
    post: (path, body, options) => apiRequest(path, { method: 'POST', body, ...options }),
    patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
    put: (path, body) => apiRequest(path, { method: 'PUT', body }),
    del: (path) => apiRequest(path, { method: 'DELETE' }),
    // FormData upload — pass a FormData instance as body (e.g. NEFT slips, documents).
    postForm: (path, formData) => apiRequest(path, { method: 'POST', body: formData }),
    putForm: (path, formData) => apiRequest(path, { method: 'PUT', body: formData }),
    // Binary download (e.g. PDF export) — resolves to a Blob, not JSON.
    getBlob: (path) => apiBlobRequest(path, { method: 'GET' }),
    // Same, but also resolves the filename the server chose (its
    // Content-Disposition header) — see shared/documents/downloadDocument.js,
    // the one place that should be saving a document to disk.
    getBlobWithFilename: (path) => apiBlobRequestWithFilename(path, { method: 'GET' }),
  };

  return { api, setAccessToken, getAccessToken, setUnauthorizedHandler, tryRefresh };
}
