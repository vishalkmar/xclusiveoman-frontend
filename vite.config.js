import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // shadcn/ui's standard "@/components/..." import convention.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // No dev-server proxy: the app always calls the backend's absolute
  // VITE_BACKEND_URI directly (shared/api/backendUrl.js), in dev exactly as
  // in production, relying on the backend's own CORS (env.corsOrigins) and
  // SameSite=None refresh cookie rather than a same-origin proxy. Point
  // VITE_BACKEND_URI at a local backend in your own (gitignored) .env if you
  // don't want dev requests hitting the deployed one.
  server: {
    // Lets the dev server be reached through an ngrok https tunnel — live
    // Cashfree only redirects back to an https return_url (AGENT_PORTAL_URL
    // on the backend), so local live-payment testing goes through one.
    allowedHosts: ['.ngrok-free.app', '.ngrok.app'],
  },
});
