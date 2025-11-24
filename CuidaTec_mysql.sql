
CREATE DATABASE IF NOT EXISTS cuidatec CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE cuidatec;

CREATE TABLE IF NOT EXISTS estudiantes (
  estudiante_id INT AUTO_INCREMENT PRIMARY KEY,
  matricula VARCHAR(30) UNIQUE,
  nombre VARCHAR(120),
  correo VARCHAR(120)
);
CREATE TABLE IF NOT EXISTS categorias (
  categoria_id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS severidades (
  severidad_id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(30) UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS estados (
  estado_id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) UNIQUE NOT NULL,
  clave VARCHAR(40) UNIQUE
);
CREATE TABLE IF NOT EXISTS transiciones_estado (
  transicion_id INT AUTO_INCREMENT PRIMARY KEY,
  estado_origen_id INT NOT NULL,
  estado_destino_id INT NOT NULL,
  UNIQUE KEY u_trans (estado_origen_id, estado_destino_id),
  FOREIGN KEY (estado_origen_id) REFERENCES estados(estado_id),
  FOREIGN KEY (estado_destino_id) REFERENCES estados(estado_id)
);
CREATE TABLE IF NOT EXISTS ubicaciones (
  ubicacion_id INT AUTO_INCREMENT PRIMARY KEY,
  calle VARCHAR(200) NOT NULL,
  colonia VARCHAR(120),
  codigo_postal VARCHAR(12),
  referencias TEXT
);
CREATE TABLE IF NOT EXISTS reportes (
  reporte_id INT AUTO_INCREMENT PRIMARY KEY,
  folio VARCHAR(40) GENERATED ALWAYS AS (CONCAT('TOR-', reporte_id)) VIRTUAL,
  titulo VARCHAR(200),
  descripcion LONGTEXT,
  categoria_id INT,
  severidad_id INT,
  estado_actual_id INT,
  ubicacion_id INT NOT NULL,
  reportante_nombre VARCHAR(120),
  reportante_contacto VARCHAR(120),
  fecha_reporte TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (categoria_id) REFERENCES categorias(categoria_id),
  FOREIGN KEY (severidad_id) REFERENCES severidades(severidad_id),
  FOREIGN KEY (estado_actual_id) REFERENCES estados(estado_id),
  FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(ubicacion_id)
);
CREATE TABLE IF NOT EXISTS evidencias (
  evidencia_id INT AUTO_INCREMENT PRIMARY KEY,
  reporte_id INT NOT NULL,
  url VARCHAR(400),
  descripcion VARCHAR(255),
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporte_id) REFERENCES reportes(reporte_id)
);
CREATE TABLE IF NOT EXISTS historial_estados (
  historial_id INT AUTO_INCREMENT PRIMARY KEY,
  reporte_id INT NOT NULL,
  estado_anterior_id INT,
  estado_nuevo_id INT NOT NULL,
  observaciones VARCHAR(255),
  fecha_cambio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporte_id) REFERENCES reportes(reporte_id),
  FOREIGN KEY (estado_anterior_id) REFERENCES estados(estado_id),
  FOREIGN KEY (estado_nuevo_id) REFERENCES estados(estado_id)
);
CREATE TABLE IF NOT EXISTS asignaciones (
  asignacion_id INT AUTO_INCREMENT PRIMARY KEY,
  reporte_id INT NOT NULL,
  estudiante_id INT,
  responsable VARCHAR(120),
  fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporte_id) REFERENCES reportes(reporte_id),
  FOREIGN KEY (estudiante_id) REFERENCES estudiantes(estudiante_id)
);
CREATE TABLE IF NOT EXISTS usuarios (
  usuario_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) UNIQUE NOT NULL,
  password_sha256 CHAR(64) NOT NULL,
  rol ENUM('user','admin') NOT NULL DEFAULT 'user',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT IGNORE INTO categorias (nombre) VALUES ('FUGA'), ('DERROCHE'), ('INFRAESTRUCTURA');
INSERT IGNORE INTO severidades (nombre) VALUES ('BAJA'), ('MEDIA'), ('ALTA');
INSERT IGNORE INTO estados (nombre, clave) VALUES ('NUEVO','NUEVO'), ('EN_PROCESO','EN_PROCESO'), ('RESUELTO','RESUELTO');
INSERT IGNORE INTO transiciones_estado (estado_origen_id, estado_destino_id)
SELECT eo.estado_id, ed.estado_id
FROM (SELECT estado_id FROM estados WHERE clave IN ('NUEVO','EN_PROCESO')) eo
JOIN (SELECT estado_id FROM estados WHERE clave IN ('EN_PROCESO','RESUELTO')) ed
ON (eo.estado_id <> ed.estado_id);
INSERT IGNORE INTO usuarios (username, password_sha256, rol) VALUES
('usuario', '830b19747b910cc6a03a5e50733d183a4de886e9f6b4c569981c2f95d9f3346e', 'user'),
('admin',   '830b19747b910cc6a03a5e50733d183a4de886e9f6b4c569981c2f95d9f3346e', 'admin');

DROP TRIGGER IF EXISTS reportes_defaults;
DELIMITER //
CREATE TRIGGER reportes_defaults
BEFORE INSERT ON reportes
FOR EACH ROW
BEGIN
  IF NEW.severidad_id IS NULL THEN
    SET NEW.severidad_id = (SELECT severidad_id FROM severidades WHERE nombre='MEDIA' LIMIT 1);
  END IF;
  IF NEW.estado_actual_id IS NULL THEN
    SET NEW.estado_actual_id = (SELECT estado_id FROM estados WHERE clave='NUEVO' LIMIT 1);
  END IF;
END//
DELIMITER ;

DROP TRIGGER IF EXISTS historial_apply;
DELIMITER //
CREATE TRIGGER historial_apply
AFTER INSERT ON historial_estados
FOR EACH ROW
BEGIN
  UPDATE reportes
     SET estado_actual_id = NEW.estado_nuevo_id,
         fecha_cierre = IF((SELECT clave FROM estados WHERE estado_id=NEW.estado_nuevo_id)='RESUELTO', NOW(), fecha_cierre)
   WHERE reporte_id = NEW.reporte_id;
END//
DELIMITER ;
