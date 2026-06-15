const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { query, testConnection, initializeDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Jalankan inisialisasi tabel database saat server dimulai
initializeDatabase();

// 1. GET / - Root endpoint untuk mengetes koneksi dasar
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Backend REST API untuk Tugas Besar Cloud Computing 2026 berjalan dengan baik.'
  });
});

// 2. GET /health - Status backend dan status koneksi database
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  
  const response = {
    status: dbConnected ? 'success' : 'error',
    message: dbConnected 
      ? 'Backend is running' 
      : 'Backend is running, but database is not connected',
    database: dbConnected ? 'connected' : 'disconnected',
    student: {
      name: process.env.STUDENT_NAME || 'Nama Mahasiswa',
      nim: process.env.STUDENT_NIM || '2311523001'
    }
  };

  res.status(dbConnected ? 200 : 500).json(response);
});

// 3. GET /schema - Konfigurasi skema JSON lengkap untuk frontend
app.get('/schema', (req, res) => {
  const schemaData = {
    student: {
      name: process.env.STUDENT_NAME || 'Larisa Alifia Handini',
      nim: process.env.STUDENT_NIM || '2411523026'
    },
    resource: {
      name: 'treatments',
      label: 'Be Clinic Treatments',
      description: 'Aplikasi untuk mengelola data Be Clinic Treatments.'
    },
    fields: [
      {
        name: 'name',
        label: 'Nama Perawatan',
        type: 'text',
        required: true,
        showInTable: true
      },
      {
        name: 'category',
        label: 'Kategori',
        type: 'text',
        required: true,
        showInTable: true
      },
      {
        name: 'price',
        label: 'Harga (Rp)',
        type: 'number',
        required: true,
        showInTable: true
      },
      {
        name: 'duration',
        label: 'Durasi (Menit)',
        type: 'number',
        required: true,
        showInTable: true
      },
      {
        name: 'description',
        label: 'Deskripsi',
        type: 'textarea',
        required: false,
        showInTable: false
      }
    ],
    endpoints: {
      list: '/treatments',
      detail: '/treatments/{id}',
      create: '/treatments',
      update: '/treatments/{id}',
      delete: '/treatments/{id}'
    }
  };

  res.json(schemaData);
});

// ============================================
// CRUD ENDPOINTS UNTUK ENTITAS PERAWATAN (TREATMENTS)
// ============================================

// 4. GET /treatments - Mengambil semua perawatan (mendukung fitur pencarian dan paginasi dasar)
app.get('/treatments', async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    let sqlQuery = 'SELECT * FROM treatments';
    let countQuery = 'SELECT COUNT(*) as total FROM treatments';
    const params = [];
    const countParams = [];

    // Fitur Pencarian
    if (search) {
      sqlQuery += ' WHERE name LIKE ? OR category LIKE ?';
      countQuery += ' WHERE name LIKE ? OR category LIKE ?';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
      countParams.push(searchParam, searchParam);
    }

    // Urutkan berdasarkan yang terbaru dimasukkan
    sqlQuery += ' ORDER BY id DESC';

    // Fitur Paginasi
    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      sqlQuery += ' LIMIT ? OFFSET ?';
      params.push(limitNum, offset);
    }

    const [rows] = await query(sqlQuery, params);
    const [countRows] = await query(countQuery, countParams);
    const total = countRows[0].total;

    // Response diformat ganda agar kompatibel dengan spek PDF (.data) dan kode frontend (.items)
    res.json({
      status: 'success',
      message: 'Data retrieved successfully',
      data: rows,
      items: rows,
      total: total
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve treatments: ' + error.message
    });
  }
});

// 5. GET /treatments/:id - Mengambil detail satu perawatan berdasarkan ID
app.get('/treatments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT * FROM treatments WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Treatment not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Treatment retrieved successfully',
      data: rows[0],
      ...rows[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve treatment: ' + error.message
    });
  }
});

// 6. POST /treatments - Membuat data perawatan baru
app.post('/treatments', async (req, res) => {
  try {
    const { name, category, price, duration, description } = req.body;

    if (!name || !category || price === undefined || duration === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Name, category, price, and duration are required'
      });
    }

    const [result] = await query(
      'INSERT INTO treatments (name, category, price, duration, description) VALUES (?, ?, ?, ?, ?)',
      [name, category, price, duration, description || null]
    );

    const newTreatmentId = result.insertId;
    const [rows] = await query('SELECT * FROM treatments WHERE id = ?', [newTreatmentId]);
    const createdTreatment = rows[0];

    res.status(201).json({
      status: 'success',
      message: 'Data created successfully',
      data: createdTreatment,
      ...createdTreatment
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create treatment: ' + error.message
    });
  }
});

// 7. PUT /treatments/:id - Memperbarui data perawatan berdasarkan ID
app.put('/treatments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, duration, description } = req.body;

    // Cek apakah data perawatan ada
    const [existing] = await query('SELECT * FROM treatments WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Treatment not found'
      });
    }

    // Update data
    await query(
      'UPDATE treatments SET name = ?, category = ?, price = ?, duration = ?, description = ? WHERE id = ?',
      [
        name !== undefined ? name : existing[0].name,
        category !== undefined ? category : existing[0].category,
        price !== undefined ? price : existing[0].price,
        duration !== undefined ? duration : existing[0].duration,
        description !== undefined ? description : existing[0].description,
        id
      ]
    );

    const [rows] = await query('SELECT * FROM treatments WHERE id = ?', [id]);
    const updatedTreatment = rows[0];

    res.json({
      status: 'success',
      message: 'Data updated successfully',
      data: updatedTreatment,
      ...updatedTreatment
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update treatment: ' + error.message
    });
  }
});

// 8. DELETE /treatments/:id - Menghapus data perawatan berdasarkan ID
app.delete('/treatments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await query('SELECT * FROM treatments WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Treatment not found'
      });
    }

    await query('DELETE FROM treatments WHERE id = ?', [id]);

    res.json({
      status: 'success',
      message: 'Data deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete treatment: ' + error.message
    });
  }
});

// Server listener
app.listen(PORT, () => {
  console.log(`Server Express berjalan pada http://localhost:${PORT}`);
});
