const mysql = require('mysql2/promise');
require('dotenv').config();

// Membuat connection pool ke database MariaDB
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Fungsi untuk mengetes koneksi database
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch (error) {
    console.error('Koneksi ke MariaDB gagal (Host: ' + process.env.DB_HOST + '):', error.message);
    return false;
  }
}

// Custom query wrapper yang langsung menggunakan database MariaDB
async function query(sql, params = []) {
  return await pool.query(sql, params);
}

// Fungsi untuk menginisialisasi tabel utama jika belum ada
async function initializeDatabase() {
  try {
    const isDbConnected = await testConnection();
    if (!isDbConnected) {
      console.error('Database MariaDB tidak aktif. Inisialisasi tabel dibatalkan.');
      return;
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS treatments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        duration INT NOT NULL,
        description TEXT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createTableQuery);
    console.log("Inisialisasi tabel 'treatments' berhasil (sudah ada atau baru dibuat).");
  } catch (error) {
    console.error('Gagal menginisialisasi tabel database:', error.message);
  }
}

module.exports = {
  pool,
  query,
  testConnection,
  initializeDatabase
};

