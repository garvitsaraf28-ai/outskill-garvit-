import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server runs the React app on :5173 and forwards any /api request to the
// backend on :3001, so the browser only ever talks to one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
