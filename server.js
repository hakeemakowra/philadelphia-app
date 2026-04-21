require('dotenv').config();
const express       = require('express');
const cookieSession = require('cookie-session');
const bcrypt        = require('bcryptjs');
const path          = require('path');
const db            = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieSession({
  name:   'philly_session',
  secret: process.env.SESSION_SECRET || 'philly-secret-2024',
  maxAge: 1000 * 60 * 60 * 8,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
}));

// ── Auth Middleware ────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ success: false, message: 'Not authenticated' });
}

// ── Helper: generate member ID ─────────────────────────────
function generateMemberId() {
  return String(Math.floor(Math.random() * 9000000) + 1000000).padStart(7, '0');
}

// ══════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════
app.get('/api/setup', async (req, res) => {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    await db.query('DELETE FROM users WHERE email = ?', ['admin@philadelphia.com']);
    await db.query('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)',
      ['Admin User', 'admin@philadelphia.com', hash, 'Admin']);
    res.json({ success: true, message: 'Admin created!' });
  } catch(err) {
    res.json({ success: false, message: err.message });
  }
});
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ success: true, redirectTo: '/dashboard.html' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'DB error: ' + err.message });
  }
});

// GET /api/me
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.session.user });
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ══════════════════════════════════════════════════════════
//  MEMBERS ROUTES
// ══════════════════════════════════════════════════════════

// GET /api/members — get all members with parents + payment counts
app.get('/api/members', requireAuth, async (req, res) => {
  try {
    const [members] = await db.query(`
      SELECT m.*,
        p_f.name         AS father_name,   p_f.phone AS father_phone,
        p_f.deceased     AS father_deceased, p_f.death_date AS father_death_date, p_f.cause AS father_cause,
        p_m.name         AS mother_name,   p_m.phone AS mother_phone,
        p_m.deceased     AS mother_deceased, p_m.death_date AS mother_death_date, p_m.cause AS mother_cause,
        (SELECT COUNT(*) FROM death_benefits   WHERE member_id = m.id) AS death_count,
        (SELECT COUNT(*) FROM wedding_benefits WHERE member_id = m.id) AS wedding_count,
        (SELECT COUNT(*) FROM documents        WHERE member_id = m.id) AS doc_count
      FROM members m
      LEFT JOIN parents p_f ON p_f.member_id = m.id AND p_f.parent_type = 'father'
      LEFT JOIN parents p_m ON p_m.member_id = m.id AND p_m.parent_type = 'mother'
      ORDER BY m.created_at DESC
    `);
    res.json({ success: true, data: members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch members.' });
  }
});

// POST /api/members — create new member
app.post('/api/members', requireAuth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      firstName, lastName, phone, gender, dob, occupation,
      branch, group, status, benefit, capturedBy, dateCaptured, photo,
      father, mother, docs
    } = req.body;

    const memberId = generateMemberId();
    const [result] = await conn.query(
      `INSERT INTO members
        (member_id, first_name, last_name, phone, gender, dob, occupation,
         branch, grp, status, benefit, captured_by, date_captured, photo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [memberId, firstName, lastName, phone, gender, dob || null, occupation,
       branch, group, status || 'active', benefit || 'No', capturedBy,
       dateCaptured || null, photo || null]
    );
    const newId = result.insertId;

    // Insert father
    if (father) {
      await conn.query(
        `INSERT INTO parents (member_id, parent_type, name, phone, deceased, death_date, cause)
         VALUES (?,?,?,?,?,?,?)`,
        [newId, 'father', father.name || '', father.phone || '',
         father.deceased ? 1 : 0, father.deathDate || null, father.cause || '']
      );
    }
    // Insert mother
    if (mother) {
      await conn.query(
        `INSERT INTO parents (member_id, parent_type, name, phone, deceased, death_date, cause)
         VALUES (?,?,?,?,?,?,?)`,
        [newId, 'mother', mother.name || '', mother.phone || '',
         mother.deceased ? 1 : 0, mother.deathDate || null, mother.cause || '']
      );
    }
    // Insert documents
    if (docs && docs.length > 0) {
      for (const doc of docs) {
        await conn.query(
          `INSERT INTO documents (member_id, file_name, file_size, file_type, file_data)
           VALUES (?,?,?,?,?)`,
          [newId, doc.name, doc.size, doc.type, doc.dataUrl]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: 'Member saved!', memberId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to save member.' });
  } finally {
    conn.release();
  }
});

// PUT /api/members/:id — update member
app.put('/api/members/:id', requireAuth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const {
      firstName, lastName, phone, gender, dob, occupation,
      branch, group, status, benefit, capturedBy, dateCaptured, photo,
      father, mother, docs
    } = req.body;

    await conn.query(
      `UPDATE members SET
        first_name=?, last_name=?, phone=?, gender=?, dob=?, occupation=?,
        branch=?, grp=?, status=?, benefit=?, captured_by=?, date_captured=?, photo=?
       WHERE id=?`,
      [firstName, lastName, phone, gender, dob || null, occupation,
       branch, group, status, benefit, capturedBy, dateCaptured || null,
       photo || null, id]
    );

    // Update parents (delete and re-insert)
    await conn.query('DELETE FROM parents WHERE member_id = ?', [id]);
    if (father) {
      await conn.query(
        `INSERT INTO parents (member_id, parent_type, name, phone, deceased, death_date, cause)
         VALUES (?,?,?,?,?,?,?)`,
        [id, 'father', father.name || '', father.phone || '',
         father.deceased ? 1 : 0, father.deathDate || null, father.cause || '']
      );
    }
    if (mother) {
      await conn.query(
        `INSERT INTO parents (member_id, parent_type, name, phone, deceased, death_date, cause)
         VALUES (?,?,?,?,?,?,?)`,
        [id, 'mother', mother.name || '', mother.phone || '',
         mother.deceased ? 1 : 0, mother.deathDate || null, mother.cause || '']
      );
    }

    // Update documents
    await conn.query('DELETE FROM documents WHERE member_id = ?', [id]);
    if (docs && docs.length > 0) {
      for (const doc of docs) {
        await conn.query(
          `INSERT INTO documents (member_id, file_name, file_size, file_type, file_data)
           VALUES (?,?,?,?,?)`,
          [id, doc.name, doc.size, doc.type, doc.dataUrl]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: 'Member updated!' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update member.' });
  } finally {
    conn.release();
  }
});

// DELETE /api/members/:id
app.delete('/api/members/:id', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM members WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Member deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete member.' });
  }
});

// GET /api/members/:id/documents
app.get('/api/members/:id/documents', requireAuth, async (req, res) => {
  try {
    const [docs] = await db.query(
      'SELECT * FROM documents WHERE member_id = ?', [req.params.id]
    );
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch documents.' });
  }
});

// ══════════════════════════════════════════════════════════
//  DEATH BENEFITS ROUTES
// ══════════════════════════════════════════════════════════

// GET /api/death-benefits
app.get('/api/death-benefits', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT db.*, CONCAT(m.first_name,' ',m.last_name) AS member_name,
             m.member_id AS member_code, m.photo
      FROM death_benefits db
      JOIN members m ON m.id = db.member_id
      ORDER BY db.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch death benefits.' });
  }
});

// GET /api/members/:id/death-benefits
app.get('/api/members/:id/death-benefits', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM death_benefits WHERE member_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch.' });
  }
});

// POST /api/members/:id/death-benefits
app.post('/api/members/:id/death-benefits', requireAuth, async (req, res) => {
  try {
    const { parentName, amount, method, payDate, notes } = req.body;
    await db.query(
      `INSERT INTO death_benefits (member_id, parent_name, amount, method, pay_date, notes)
       VALUES (?,?,?,?,?,?)`,
      [req.params.id, parentName, amount, method, payDate || null, notes || '']
    );
    res.json({ success: true, message: 'Death benefit recorded!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to record death benefit.' });
  }
});

// DELETE /api/death-benefits/:id
app.delete('/api/death-benefits/:id', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM death_benefits WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Death benefit deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete death benefit.' });
  }
});

// ══════════════════════════════════════════════════════════
//  WEDDING BENEFITS ROUTES
// ══════════════════════════════════════════════════════════

// GET /api/wedding-benefits
app.get('/api/wedding-benefits', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT wb.*, CONCAT(m.first_name,' ',m.last_name) AS member_name,
             m.member_id AS member_code, m.photo
      FROM wedding_benefits wb
      JOIN members m ON m.id = wb.member_id
      ORDER BY wb.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch wedding benefits.' });
  }
});

// GET /api/members/:id/wedding-benefits
app.get('/api/members/:id/wedding-benefits', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM wedding_benefits WHERE member_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch.' });
  }
});

// POST /api/members/:id/wedding-benefits
app.post('/api/members/:id/wedding-benefits', requireAuth, async (req, res) => {
  try {
    const { spouseName, weddingDate, venue, amount, method, payDate, notes } = req.body;
    await db.query(
      `INSERT INTO wedding_benefits
        (member_id, spouse_name, wedding_date, venue, amount, method, pay_date, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [req.params.id, spouseName, weddingDate, venue || '', amount, method, payDate || null, notes || '']
    );
    res.json({ success: true, message: 'Wedding benefit recorded!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to record wedding benefit.' });
  }
});

// DELETE /api/wedding-benefits/:id
app.delete('/api/wedding-benefits/:id', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM wedding_benefits WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Wedding benefit deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete wedding benefit.' });
  }
});

// ══════════════════════════════════════════════════════════
//  USER MANAGEMENT ROUTES
// ══════════════════════════════════════════════════════════

// GET /api/users
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email, role, created_at FROM users');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
});

// POST /api/users — create new user
app.post('/api/users', requireAuth, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password required.' });
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)',
      [name, email.toLowerCase(), hash, role || 'Staff']
    );
    res.json({ success: true, message: 'User created!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ success: false, message: 'Email already exists.' });
    res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
});

// PUT /api/users/:id — update name and email
app.put('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email)
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    await db.query('UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email.toLowerCase(), req.params.id]);
    if (req.session.user && req.session.user.id == req.params.id) {
      req.session.user.name  = name;
      req.session.user.email = email.toLowerCase();
    }
    res.json({ success: true, message: 'Profile updated!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ success: false, message: 'Email already in use.' });
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// PUT /api/users/:id/password — change password
app.put('/api/users/:id/password', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.params.id]);
    res.json({ success: true, message: 'Password updated!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
});

// ── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Philadelphia Movement App running at http://localhost:${PORT}`);
  console.log(`\n📋 Default Login:`);
  console.log(`   admin@philadelphia.com  → password`);
  console.log(`   adom@gmail.com          → password\n`);
});
