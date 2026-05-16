import axios from "axios";

// Relative baseURL works from any host (laptop localhost, phone via Tailscale, LAN IP).
// In dev, Vite's proxy forwards /api/* to the Flask backend at :5001.
const api = axios.create({
  baseURL: "/api",
});

export default api;
