import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// No StrictMode on purpose: it double-mounts effects in dev, which makes the
// speech-recognition / voice setup behave erratically. The real app is fine.
createRoot(document.getElementById("root")).render(<App />);
