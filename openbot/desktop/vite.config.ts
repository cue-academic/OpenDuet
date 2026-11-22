import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 3020 so a running deployment's app (3010) and API (3001) are untouched while the shell is
// developed against them.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // Cargo locks files under src-tauri/target while it builds; watching them makes `tauri dev`
  // crash with EBUSY on Windows.
  server: {
    port: 3020,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
