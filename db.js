// db.js — MySQL connection pool
const mysql = require('mysql2/promise');
require('dotenv').config();

let poolConfig;

if (process.env.DATABASE_URL) {
  // Railway provides a full connection URL
  poolConfig = {
    uri:                process.env.DATABASE_URL,
    ssl:                { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  };
} else {
  poolConfig = {
    host:               process.env.DB_HOST     || 'localhost',
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || 'password',
    database:           process.env.DB_NAME     || 'philadelphia_db',
    port:               parseInt(process.env.DB_PORT) || 3306,
    ssl:                process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  };
}

const pool = mysql.createPool(poolConfig);

pool.getConnection()
  .then(conn => { console.log('✅ MySQL connected!'); conn.release(); })
  .catch(err => console.error('❌ MySQL connection failed:', err.message));

module.exports = pool;
