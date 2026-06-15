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

let useMock = false;
let mockTreatments = [
  { id: 1, name: 'Photo Facial Glow', category: 'Facial', price: 350000, duration: 45, description: 'Perawatan wajah menggunakan teknologi cahaya untuk mencerahkan kulit secara instan.' },
  { id: 2, name: 'Underarm Hair Removal', category: 'Laser', price: 250000, duration: 20, description: 'Menghilangkan bulu ketiak menggunakan teknologi laser berbasis cahaya (IPL).' },
  { id: 3, name: 'Active Acne Laser', category: 'Laser', price: 400000, duration: 30, description: 'Perawatan laser untuk meredakan jerawat aktif dan mengurangi peradangan.' }
];
let nextId = 4;

// Fungsi untuk mengetes koneksi database
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    useMock = false;
    return true;
  } catch (error) {
    if (!useMock) {
      console.warn('\n=== INFO DEV OFFLINE ===');
      console.warn('Koneksi ke MariaDB gagal (Host: ' + process.env.DB_HOST + ').');
      console.warn('Aplikasi secara otomatis berjalan dalam MOCK MODE (data disimpan di memori sementara).');
      console.warn('Untuk pengumpulan tugas akhir, pastikan Anda menghubungkannya ke VM database MariaDB yang asli.\n');
      useMock = true;
    }
    return false;
  }
}

// Custom query wrapper yang mendukung fallback Mock Mode
async function query(sql, params = []) {
  if (!useMock) {
    try {
      return await pool.query(sql, params);
    } catch (error) {
      console.warn('Koneksi database terputus, beralih ke Mock Mode:', error.message);
      useMock = true;
    }
  }

  // Simulasikan Query SQL secara sederhana
  const sqlClean = sql.replace(/\s+/g, ' ').trim();

  // 1. SELECT COUNT(*) as total FROM treatments
  if (sqlClean.startsWith('SELECT COUNT')) {
    let count = mockTreatments.length;
    if (sqlClean.includes('WHERE name LIKE')) {
      const searchVal = params[0].replace(/%/g, '').toLowerCase();
      count = mockTreatments.filter(t => 
        t.name.toLowerCase().includes(searchVal) || 
        t.category.toLowerCase().includes(searchVal)
      ).length;
    }
    return [[{ total: count }]];
  }

  // 2. SELECT * FROM treatments ...
  if (sqlClean.startsWith('SELECT * FROM treatments')) {
    // 2a. SELECT * FROM treatments WHERE id = ? (detail)
    if (sqlClean.includes('WHERE id = ?')) {
      const id = parseInt(params[0]);
      const treatment = mockTreatments.find(t => t.id === id);
      return [treatment ? [treatment] : []];
    }

    let rows = [...mockTreatments];

    // 2b. Search filter
    if (sqlClean.includes('WHERE name LIKE')) {
      const searchVal = params[0].replace(/%/g, '').toLowerCase();
      rows = rows.filter(t => 
        t.name.toLowerCase().includes(searchVal) || 
        t.category.toLowerCase().includes(searchVal)
      );
    }

    // 2c. Order by id desc
    if (sqlClean.includes('ORDER BY id DESC')) {
      rows.sort((a, b) => b.id - a.id);
    }

    // 2d. Limit & Offset
    if (sqlClean.includes('LIMIT ? OFFSET ?')) {
      const limit = parseInt(params[0]);
      const offset = parseInt(params[1]);
      rows = rows.slice(offset, offset + limit);
    }

    return [rows];
  }

  // 3. INSERT INTO treatments ...
  if (sqlClean.startsWith('INSERT INTO')) {
    const newTreatment = {
      id: nextId++,
      name: params[0],
      category: params[1],
      price: params[2] ? parseFloat(params[2]) : 0,
      duration: params[3] ? parseInt(params[3]) : 0,
      description: params[4] || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockTreatments.push(newTreatment);
    return [{ insertId: newTreatment.id }];
  }

  // 4. UPDATE treatments ...
  if (sqlClean.startsWith('UPDATE treatments')) {
    const name = params[0];
    const category = params[1];
    const price = params[2] ? parseFloat(params[2]) : 0;
    const duration = params[3] ? parseInt(params[3]) : 0;
    const description = params[4] || null;
    const id = parseInt(params[5]);

    const idx = mockTreatments.findIndex(t => t.id === id);
    if (idx !== -1) {
      mockTreatments[idx] = {
        ...mockTreatments[idx],
        name,
        category,
        price,
        duration,
        description,
        updatedAt: new Date()
      };
      return [{ affectedRows: 1 }];
    }
    return [{ affectedRows: 0 }];
  }

  // 5. DELETE FROM treatments WHERE id = ?
  if (sqlClean.startsWith('DELETE FROM')) {
    const id = parseInt(params[0]);
    const originalCount = mockTreatments.length;
    mockTreatments = mockTreatments.filter(t => t.id !== id);
    return [{ affectedRows: originalCount - mockTreatments.length }];
  }

  return [[]];
}

// Fungsi untuk menginisialisasi tabel utama jika belum ada
async function initializeDatabase() {
  try {
    const isDbConnected = await testConnection();
    if (!isDbConnected) {
      console.log('Database MariaDB tidak aktif. Tabel treatments akan disimulasikan di memori.');
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
