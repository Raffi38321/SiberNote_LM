import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend SiberNote LM dipanggil langsung lewat VITE_API_BASE_URL (lihat src/api.js),
// jadi tidak perlu proxy di sini. Pastikan backend mengaktifkan CORS untuk
// origin http://localhost:8080 saat development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
  },
});
