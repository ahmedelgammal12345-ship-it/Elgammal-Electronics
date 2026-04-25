import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  window.parent?.postMessage({ type: "STUNNING_APP_ERROR", error: "MISSING_CONVEX_URL" }, "*");

  createRoot(document.getElementById("root")!).render(
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ color: "#e53e3e" }}>⚠️ Configuration Error</h1>
      <p>Missing VITE_CONVEX_URL environment variable.</p>
    </div>
  );
} else {
  const convex = new ConvexReactClient(convexUrl);

  createRoot(document.getElementById("root")!).render(
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  );
}
