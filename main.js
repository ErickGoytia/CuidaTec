// Configuración global CuidaTec (API + tema)
(function(){
  // API base (ajusta si cambias puerto)
 // =====================
// Configuración de API
// =====================

// URL pública vía ngrok (la que te dio ngrok)
const PUBLIC_API = "https://spherulate-edgingly-candis.ngrok-free.dev";

// API local (para cuando tú desarrollas en tu PC)
const LOCAL_API = "http://127.0.0.1:9090";

// Estamos "en local" si abrimos desde 127.0.0.1 o localhost
const isLocalHost =
  location.hostname === "127.0.0.1" ||
  location.hostname === "localhost";

// Si estás en tu máquina -> usa LOCAL_API
// Si se abre desde otra red / dominio -> usa la API pública (ngrok)
window.API_BASE = isLocalHost ? LOCAL_API : PUBLIC_API;




  // Tema oscuro/claro CuidaTec
(function(){
  const KEY = 'cuidatec-theme';
  const root = document.documentElement;

  function applyTheme(t){
    root.setAttribute('data-theme', t);
  }

  // Tema inicial (guardado o preferencia del sistema)
  const saved = localStorage.getItem(KEY);
  const prefersDark = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (prefersDark ? 'dark' : 'dark'); // forzamos dark como default
  applyTheme(initial);

  // Botón en el header
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    if (!header) return;

    const btn = document.createElement('button');
   
    btn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(KEY, next);
      label();
    });
    label();
    header.appendChild(btn);
  });
})();

  const STORAGE_KEY = 'cuidatec-theme';

  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
  }

  function initTheme(){
    const saved = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    const initial = saved || (prefersDark ? 'dark' : 'dark');
    applyTheme(initial);
  }

  function createThemeToggle(){
    const header = document.querySelector('.header');
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.className = 'btn ghost small';

    function label(){
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      btn.textContent = current === 'dark' ? '☀️ Claro' : '🌙 Oscuro';
    }

    btn.addEventListener('click', ()=>{
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
      label();
    });

    label();
    header.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    initTheme();
    createThemeToggle();
  });
})();
