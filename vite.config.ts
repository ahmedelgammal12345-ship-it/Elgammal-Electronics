import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // The code below enables dev tools like taking screenshots of your site
    // while it is being developed on stunning.so.
    // Feel free to remove this code if you're no longer developing your app with Stunning.
    mode === "development"
      ? {
          name: "inject-stunning-dev",
          transform(code: string, id: string) {
            if (id.includes("main.tsx")) {
              return {
                code: `${code}

/* Added by Vite plugin inject-stunning-dev */
window.addEventListener('message', async (message) => {
  if (message.source !== window.parent) return;
  if (message.data.type !== 'stunningPreviewRequest') return;

  // Detect if running in WebContainer (preview environment)
  const isWebContainer = window.location.hostname.includes('webcontainer-api.io');
  const workerUrl = isWebContainer
    ? 'https://builder.stunning.so/scripts/worker.bundled.mjs'
    : window.location.origin + '/scripts/worker.bundled.mjs';

  const worker = await import(workerUrl);
  await worker.respondToMessage(message);
});
            `,
                map: null,
              };
            }
            return null;
          },
        }
      : null,
    // End of code for taking screenshots on stunning.so.
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
