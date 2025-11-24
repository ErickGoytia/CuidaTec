// server.js — CuidaTec (versión completa)

require('dotenv').config();

const express = require('express');

const jwt     = require('jsonwebtoken');
const mysql   = require('mysql2/promise');

const app  = express();
const PORT = process.env.PORT || 9090;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

console.log('[BOOT]', new Date().toISOString());

// ----------------------
//  Middleware
// ----------------------
app.use(express.json());

const allowedOrigin = 'http://127.0.0.1:5500';

const cors = require('cors');

// Permitir todas las origins (simple para pruebas y proyectos escolares)
app.use(cors());

// ----------------------
//  Pool MySQL
// ----------------------
const pool = mysql.createPool({
  host    : process.env.DB_HOST || 'localhost',
  port    : process.env.DB_PORT || 3306,
  user    : process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cuidatec',
  waitForConnections: true,
  connectionLimit   : 10
});

(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[DB] Conexión OK');
  } catch (e) {
    console.error('[DB] Error de conexión:', e.message);
  }
})();

// ----------------------
//  Auth middleware
// ----------------------
function auth(requiredRole) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (requiredRole && payload.role !== requiredRole) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.user = payload;
      next();
    } catch (e) {
      console.error('[AUTH] error', e.message);
      return res.status(401).json({ error: 'Token inválido' });
    }
  };
}

// ----------------------
//  Login básico
// ----------------------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  console.log('[LOGIN] body:', req.body);

  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  let role = null;

  if (username === 'admin' && password === 'teclag') {
    role = 'admin';
  } else if (username === 'usuario' && password === 'teclag') {
    role = 'user';
  } else {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign(
    { username, role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, role });
});

// ----------------------
//  Crear reporte (página reportar)
// ----------------------
app.post('/api/reports', async (req, res) => {
  const {
    calle,
    colonia,
    codigo_postal,
    referencias,
    titulo,
    descripcion,
    categoria_id,
    severidad_id,
    reportante_nombre,
    reportante_contacto
  } = req.body || {};

  if (!descripcion || !calle) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const tituloFinal =
    (titulo && titulo.trim()) ||
    (descripcion && descripcion.trim().slice(0, 60)) ||
    'Reporte de fuga';

  const conn = await pool.getConnection();
  try {
    // Desactivar checks de FK SOLO en esta conexión
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.beginTransaction();

    // 1) Insertar la ubicación
    const [ubicRes] = await conn.execute(
      `INSERT INTO ubicaciones (calle, colonia, codigo_postal, referencias)
       VALUES (?,?,?,?)`,
      [
        calle || '',
        colonia || '',
        codigo_postal || '',
        referencias || ''
      ]
    );
    const ubicacion_id = ubicRes.insertId;

    // 2) Buscar estado inicial (NUEVO / PENDIENTE)
    let estadoInicialId = null;
    const [estRows] = await conn.execute(
      `SELECT estado_id FROM estados
       WHERE UPPER(nombre) IN ('NUEVO','PENDIENTE')
       ORDER BY estado_id LIMIT 1`
    );
    if (estRows.length) estadoInicialId = estRows[0].estado_id;

    // 3) Insertar reporte
    const [repRes] = await conn.execute(
      `INSERT INTO reportes
       (folio, titulo, descripcion, fecha_reporte,
        ubicacion_id, categoria_id, severidad_id,
        estado_actual_id, reportante_nombre, reportante_contacto, eliminado)
       VALUES (?,?,?,?,NOW(),?,?,?,?,?,0)`,
      [
        null,
        tituloFinal,
        descripcion,
        ubicacion_id,
        categoria_id || null,
        severidad_id || null,
        estadoInicialId,
        reportante_nombre || null,
        reportante_contacto || null
      ]
    );

    const reporte_id = repRes.insertId;

    await conn.commit();
    // Volver a activar checks
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    res.status(201).json({ ok: true, reporte_id });
  } catch (e) {
    try {
      await conn.rollback();
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_) {}
    console.error('[CREATE REPORT] error', e);
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});



// ----------------------
//  Listar reportes (admin)
// ----------------------
app.get('/api/reports', auth('admin'), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        r.reporte_id,
        r.folio,
        r.titulo,
        e.nombre AS estado,
        DATE_FORMAT(r.fecha_reporte,'%Y-%m-%d %H:%i') AS fecha_reporte
      FROM reportes r
      JOIN estados e ON e.estado_id = r.estado_actual_id
      WHERE IFNULL(r.eliminado, 0) = 0
      ORDER BY r.reporte_id DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[LIST REPORTS] error', e);
    res.status(500).json({ error: 'List failed' });
  }
});

// ----------------------
//  Marcar reporte como resuelto
// ----------------------
app.patch('/api/reports/:id/resolve', auth('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Obtener estado actual
    const [curRows] = await conn.execute(
      'SELECT estado_actual_id FROM reportes WHERE reporte_id = ?',
      [id]
    );
    if (!curRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    const estadoAnterior = curRows[0].estado_actual_id;

    // Buscar estado "RESUELTO"
    let estadoResueltoId = estadoAnterior;
    const [estRows] = await conn.execute(
      `SELECT estado_id FROM estados
       WHERE UPPER(nombre) IN ('RESUELTO','CERRADO')
       ORDER BY estado_id LIMIT 1`
    );
    if (estRows.length) {
      estadoResueltoId = estRows[0].estado_id;
    }

    // Actualizar reporte
    await conn.execute(
      `UPDATE reportes
       SET estado_actual_id = ?, fecha_cierre = NOW()
       WHERE reporte_id = ?`,
      [estadoResueltoId, id]
    );

    // Insertar en historial_estados si existe
    await conn.execute(
      `INSERT INTO historial_estados
       (reporte_id, estado_anterior_id, estado_nuevo_id, observaciones, fecha_cambio)
       VALUES (?,?,?,?,NOW())`,
      [id, estadoAnterior, estadoResueltoId, 'Marcado resuelto desde panel admin']
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('[RESOLVE REPORT] error', e);
    res.status(500).json({ error: 'Resolve failed' });
  } finally {
    conn.release();
  }
});

// ----------------------
//  Borrado lógico (soft delete)
// ----------------------
app.delete('/api/reports/:id', auth('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  try {
    const [result] = await pool.execute(
      'UPDATE reportes SET eliminado = 1 WHERE reporte_id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[DELETE REPORT] error', e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ----------------------
//  Detalle de reporte (admin)
// ----------------------
app.get('/api/reports/:id/detail', auth('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  try {
    const [infoRows] = await pool.execute(`
      SELECT
        r.reporte_id,
        r.folio,
        r.titulo,
        r.descripcion,

        CASE
          WHEN r.fecha_reporte IS NULL OR r.fecha_reporte = '0000-00-00 00:00:00'
          THEN NULL
          ELSE DATE_FORMAT(r.fecha_reporte, '%Y-%m-%d %H:%i')
        END AS fecha_reporte,

        CASE
          WHEN r.fecha_cierre IS NULL OR r.fecha_cierre = '0000-00-00 00:00:00'
          THEN NULL
          ELSE DATE_FORMAT(r.fecha_cierre, '%Y-%m-%d %H:%i')
        END AS fecha_cierre,

        e.nombre AS estado,
        c.nombre AS categoria,
        s.nombre AS severidad,

        u.calle,
        u.colonia,
        u.codigo_postal,
        u.referencias,

        r.reportante_nombre,
        r.reportante_contacto
      FROM reportes r
      LEFT JOIN ubicaciones u ON u.ubicacion_id = r.ubicacion_id
      LEFT JOIN estados     e ON e.estado_id = r.estado_actual_id
      LEFT JOIN categorias  c ON c.categoria_id = r.categoria_id
      LEFT JOIN severidades s ON s.severidad_id = r.severidad_id
      WHERE r.reporte_id = ?
      LIMIT 1
    `, [id]);

    if (!infoRows.length) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    const info = infoRows[0];

    const [historial] = await pool.execute(`
      SELECT
        he.historial_id,
        ea.nombre AS estado_anterior,
        en.nombre AS estado_nuevo,
        he.observaciones,
        DATE_FORMAT(he.fecha_cambio,'%Y-%m-%d %H:%i') AS fecha_cambio
      FROM historial_estados he
      LEFT JOIN estados ea ON ea.estado_id = he.estado_anterior_id
      LEFT JOIN estados en ON en.estado_id = he.estado_nuevo_id
      WHERE he.reporte_id = ?
      ORDER BY he.fecha_cambio ASC, he.historial_id ASC
    `, [id]);

    const [asignaciones] = await pool.execute(`
      SELECT
        a.asignacion_id,
        DATE_FORMAT(a.fecha_asignacion,'%Y-%m-%d %H:%i') AS fecha_asignacion,
        a.responsable,
        e.matricula,
        e.nombre AS estudiante_nombre,
        e.correo
      FROM asignaciones a
      LEFT JOIN estudiantes e ON e.estudiante_id = a.estudiante_id
      WHERE a.reporte_id = ?
      ORDER BY a.fecha_asignacion DESC, a.asignacion_id DESC
    `, [id]);

    res.json({ info, historial, asignaciones });

  } catch (e) {
    console.error('[DETAIL ERROR]', e);
    res.status(500).json({ error: 'Detail failed' });
  }
});


// ----------------------
//  Lista de estudiantes / brigadas (admin)
// ----------------------
app.get('/api/students', auth('admin'), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        estudiante_id,
        matricula,
        nombre,
        correo
      FROM estudiantes
      ORDER BY nombre ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[STUDENTS] error', e);
    res.status(500).json({ error: 'Students failed' });
  }
});

// ----------------------
//  Asignar reporte a brigada / responsable (admin)
// ----------------------
app.post('/api/reports/:id/assign', auth('admin'), async (req, res) => {
  const id = Number(req.params.id);
  const { estudiante_id, responsable } = req.body || {};

  if (!id || (!estudiante_id && !responsable)) {
    return res.status(400).json({ error: 'Datos de asignación incompletos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO asignaciones
       (reporte_id, estudiante_id, responsable, fecha_asignacion)
       VALUES (?,?,?,NOW())`,
      [id, estudiante_id || null, responsable || null]
    );

    await conn.commit();
    res.status(201).json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('[ASSIGN] error', e);
    res.status(500).json({ error: 'Assign failed' });
  } finally {
    conn.release();
  }
});

// ----------------------
//  Tips (Consejos)
// ----------------------
app.get('/api/tips', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT titulo, descripcion
      FROM tips
      ORDER BY id ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[TIPS] error', e);
    res.status(500).json({ error: 'Tips failed' });
  }
});

// ----------------------
//  Health check
// ----------------------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ----------------------
//  Start
// ----------------------
app.listen(PORT, () => {
  console.log('[LISTEN] API on http://localhost:' + PORT);
});
