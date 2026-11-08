/**
 * ==============================================================================
 * CONEXIÓN MYSQL (POOL CON MYSQL2/PROMISE)
 * ==============================================================================
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tienda_admin',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let isConnected = false;

function getPool() {
  if (!pool) {
    try {
      pool = mysql.createPool(dbConfig);
    } catch (err) {
      console.warn('Advertencia: No se pudo crear el pool de MySQL:', err.message);
    }
  }
  return pool;
}

// Probar conexión inicial y crear base de datos / tablas si no existen
async function testConnection() {
  try {
    // Primero intentar conectar sin seleccionar base de datos para crearla si no existe
    const rootConn = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();

    const p = getPool();
    const [rows] = await p.query('SELECT 1 + 1 AS result');
    isConnected = true;
    console.log(`Conexión a MySQL exitosa [${dbConfig.host}:${dbConfig.port} -> ${dbConfig.database}]`);

    // Crear tablas básicas si no existen
    await p.query(`
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
        INDEX idx_codigo (codigo_barras)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id INT AUTO_INCREMENT PRIMARY KEY,
        producto_id INT NOT NULL,
        tipo_movimiento ENUM('entrada_recepcion', 'ajuste_manual', 'venta', 'merma') NOT NULL,
        cantidad INT NOT NULL,
        stock_anterior INT NOT NULL,
        stock_nuevo INT NOT NULL,
        precio_costo_unitario DECIMAL(10, 2) DEFAULT NULL,
        notas VARCHAR(255) DEFAULT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS cola_pendientes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codigo_barras VARCHAR(50) NOT NULL,
        motivo VARCHAR(100) DEFAULT 'offline_sin_conexion',
        procesado TINYINT(1) DEFAULT 0,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_procesado TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_procesado (procesado)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    return true;
  } catch (err) {
    isConnected = false;
    console.warn(`MySQL no disponible en este momento (${err.message}). El servidor usará almacenamiento local de memoria/archivo como respaldo.`);
    return false;
  }
}

module.exports = {
  getPool,
  testConnection,
  isDbConnected: () => isConnected
};

