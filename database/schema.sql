-- ==============================================================================
-- BASE DE DATOS: TiendaAdmin
-- Módulo de Recepción de Inventario y Control de Stock
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS tienda_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tienda_admin;

-- 1. Tabla de Productos
CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_barras VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    marca VARCHAR(100) DEFAULT NULL,
    categoria VARCHAR(100) DEFAULT NULL,
    precio_costo DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    precio_venta DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    origen_datos ENUM('local', 'openfoodfacts', 'manual') DEFAULT 'manual',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_codigo (codigo_barras),
    INDEX idx_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabla de Movimientos de Inventario (Kardex de entradas)
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    tipo_movimiento ENUM('entrada_recepcion', 'ajuste_manual', 'venta', 'merma') NOT NULL,
    cantidad INT NOT NULL,
    stock_anterior INT NOT NULL,
    stock_nuevo INT NOT NULL,
    precio_costo_unitario DECIMAL(10, 2) DEFAULT NULL,
    notas VARCHAR(255) DEFAULT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Cola de Códigos Pendientes (Fallback Offline para consultar cuando regrese internet)
CREATE TABLE IF NOT EXISTS cola_pendientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_barras VARCHAR(50) NOT NULL,
    motivo VARCHAR(100) DEFAULT 'offline_sin_conexion',
    procesado TINYINT(1) DEFAULT 0,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_procesado TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_procesado (procesado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

