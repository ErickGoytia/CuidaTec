// assets/js/main.js

(function () {
  // URL pública de tu API (ngrok)
  // Si ngrok te da una nueva, CAMBIA solo esta línea:
  const PUBLIC_API = "https://spherulate-edgingly-candis.ngrok-free.dev";

  // API local para cuando trabajas en tu máquina
  const LOCAL_API = "http://127.0.0.1:9090";

  // Estamos en "local" si la página se sirve desde localhost o 127.0.0.1
  const isLocalHost =
    location.hostname === "127.0.0.1" ||
    location.hostname === "localhost";

  // Define la base de la API según de dónde se sirva el frontend
  window.API_BASE = (isLocalHost ? LOCAL_API : PUBLIC_API).replace(/\/+$/, "");

  console.log("[API_BASE]", window.API_BASE);
})();
