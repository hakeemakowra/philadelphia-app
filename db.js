// db.js — MySQL connection pool
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

if (process.env.DATABASE_URL) {
  // Parse full connection URL (Railway provides this)
  pool = mysql.createPool(process.env.DATABASE_URL + '?ssl={"rejectUnauthorized":false}');
} else {
  pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME     || 'philadelphia_db',
    port:     process.env.DB_PORT     || 3306,
    ssl:      process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  });
}

pool.getConnection()
  .then(conn => { console.log('✅ MySQL connected!'); conn.release(); })
  .catch(err => console.error('❌ MySQL connection failed:', err.message));

module.exports = pool;
