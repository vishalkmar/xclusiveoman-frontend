// Single source of truth for the backend's absolute origin. Every REST call
// (createApiClient.js, the *Editor.jsx autosave-on-unload fetches, the PDF
// print pages) and the Socket.IO client (createSocketClient.js) go through
// this instead of each hardcoding '/api' or reading VITE_API_PROXY_TARGET
// directly — there is no same-origin Apache/Vercel proxy in front of the API
// anymore, so every request is a direct cross-origin call to this URL.
let cachedBackendUrl;

export function getBackendUrl() {
  if (cachedBackendUrl === undefined) {
    const raw = import.meta.env.VITE_BACKEND_URI;
    if (!raw) {
      throw new Error(
        "VITE_BACKEND_URI is not set. Set it (e.g. in .env) to the backend's public URL, " +
          'e.g. VITE_BACKEND_'
      );
    }
    cachedBackendUrl = raw.replace(/\/+$/, '');
  }
  return cachedBackendUrl;
}

export function getApiBaseUrl() {
  return `${getBackendUrl()}/api`;
}
