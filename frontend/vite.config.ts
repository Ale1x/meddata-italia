import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy: {
      "/api": { target: process.env.VITE_DEV_API_PROXY ?? "http://localhost:8080", changeOrigin: true },
      "/health": { target: process.env.VITE_DEV_API_PROXY ?? "http://localhost:8080", changeOrigin: true },
    },
  },
})
