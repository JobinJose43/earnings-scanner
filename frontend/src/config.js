// Public builds read pre-generated JSON and never contact a backend.
export const IS_PUBLIC = process.env.REACT_APP_PUBLIC_MODE === "1";
export const API_BASE = process.env.REACT_APP_PUBLIC_MODE === "1" ? "" : process.env.REACT_APP_API_BASE || "http://localhost:8001";
export const WS_BASE = API_BASE.replace(/^http/, "ws");
