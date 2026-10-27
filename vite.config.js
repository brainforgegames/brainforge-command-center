import { defineConfig } from "vite";
import { boardMiddleware } from './orchestrator/board-view.mjs';
export default defineConfig({
  plugins: process.env.BCC_LOCAL_QUEUE ? [{name:'durable-local-board',configureServer(server){server.middlewares.use(boardMiddleware(process.env.BCC_LOCAL_QUEUE));},configurePreviewServer(server){server.middlewares.use(boardMiddleware(process.env.BCC_LOCAL_QUEUE));}}] : [],
  base: "./",
  build: { chunkSizeWarningLimit: 800 },
});
