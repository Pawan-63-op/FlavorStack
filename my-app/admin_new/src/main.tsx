// @ts-nocheck — Vite entry point, not used by Next.js

  import { createRoot } from "react-dom/client";
  import App from "./App.js";
  import "./index.css";

  createRoot(document.getElementById("root")!).render(<App />);
  