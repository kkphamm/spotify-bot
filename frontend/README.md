# AI Music Assistant — Frontend

React + Vite + Tailwind + Electron desktop app for the AI Music Assistant. Voice input uses a global hotkey and a floating pill visualizer.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Vite production build → `dist/` |
| `npm run electron:dev` | Build in watch mode + run Electron |
| `npm run electron:build` | Build and package with electron-builder |
| `npm run electron:start` | Run Electron (assumes `dist/` exists) |

---

## Structure

- **`electron/`** — Main process (`main.cjs`), preload (`preload.cjs`), global hotkey (Ctrl+Shift+Space), overlay window.
- **`src/`** — React app: `App.jsx`, `main.jsx`, `api.js`; `components/` (Sidebar, VoiceAssistant, FeatureGrid, Topbar); `pages/` (Home, PillOverlay).

For full setup and API details, see the [root README](../README.md).
