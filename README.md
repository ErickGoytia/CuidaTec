
# CuidaTec — SQL (MySQL/XAMPP) + Express + Frontend con animaciones

## 1) Base de datos (MySQL/XAMPP)
1. Inicia MySQL en XAMPP.
2. Ejecuta **sql/CuidaTec_mysql.sql** (crea DB `cuidatec`, tablas, triggers y datos base).
   - Usuarios demo para login:
     - usuario / teclag (user)
     - admin / teclag (admin)

## 2) Backend
```bash
cd backend
npm install
cp ../.env.example ../.env    # ajusta DB_USER/DB_PASSWORD
npm start
```
API en `http://localhost:8080`.

## 3) Frontend (VS Code + Live Server)
Abre `frontend/index.html` o `frontend/login.html` con Live Server.

## 4) Flujo
- `login.html` → `/api/login` → guarda token/rol.
- `reportar.html` → `/api/reports` crea ubicación + reporte. Defaults (estado NUEVO, severidad MEDIA) por trigger.
- `admin.html` (rol admin) → `/api/reports` lista y `PATCH /api/reports/:id/resolve` resuelve (trigger actualiza estado/fecha).

## 5) Qué falta o puedes mejorar
- **Autorización fina**: proteger `/api/reports` POST con JWT si quieres solo usuarios registrados.
- **Validación/Archivos**: endpoint para subir fotos a `evidencias`.
- **Tabla `tips`**: crear una simple `tips(titulo, descripcion)` y cambiar `/api/tips` a SELECT real.
- **ReCAPTCHA/email**: evitar spam y enviar confirmaciones.
- **Despliegue**: mover a un VPS y usar Nginx como proxy + PM2 para Node.

