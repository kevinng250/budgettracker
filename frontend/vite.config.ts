import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on all interfaces so the phone can hit Vite over Tailscale / LAN.
    host: true,
    // Allow Tailscale MagicDNS hosts (`*.ts.net`) in addition to the defaults.
    // The leading dot is Vite's syntax for "any subdomain of this".
    allowedHosts: ['.ts.net'],
    proxy: {
      // Frontend uses relative /api URLs; Vite forwards them to the Flask backend.
      // This makes the phone-via-Tailscale flow work without hardcoding hostnames.
      '/api': 'http://localhost:5001',
    },
  },
})
