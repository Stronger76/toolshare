const express = require('express');
const cors = require('cors');
const path = require('path');

// Bypass self-signed certificate issues for hosted Postgres database connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const db = require('./db');
const { dbReady } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Database Diagnostics Route (helps identify connection issues without checking Vercel logs)
app.get('/api/diag', async (req, res) => {
  try {
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    const isPostgres = !!dbUrl;
    
    let dbStatus = "Unknown";
    let dbError = null;
    let tables = [];

    if (isPostgres) {
      const { Pool } = require('pg');
      const testPool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
      });
      try {
        const result = await testPool.query("SELECT NOW()");
        dbStatus = "Connected to PostgreSQL successfully!";
        
        const tablesResult = await testPool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        tables = tablesResult.rows.map(r => r.table_name);
      } catch (err) {
        dbStatus = "Failed to connect to PostgreSQL";
        dbError = err.message;
      } finally {
        await testPool.end();
      }
    } else {
      dbStatus = "Using SQLite fallback";
    }

    res.json({
      postgres_detected: isPostgres,
      postgres_url_present: !!process.env.POSTGRES_URL,
      database_url_present: !!process.env.DATABASE_URL,
      status: dbStatus,
      error: dbError,
      tables: tables
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Wait for database to be ready before handling API requests
app.use('/api', async (req, res, next) => {
  try {
    if (dbReady) await dbReady;
    next();
  } catch (err) {
    console.error('DB init middleware error:', err);
    res.status(500).json({ error: 'Database not ready' });
  }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Create mock images folder if it doesn't exist
const fs = require('fs');
const imagesDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Generate simple SVG files for our tools if they don't exist
const svgIcons = {
  'drill.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 70l15 15h15l-10-25M35 60l25-25M60 35l15-15a10 10 0 0 1 14 14L75 48M45 50l10 10" />
    <rect x="15" y="65" width="10" height="15" rx="2" fill="#334155" stroke="none" />
    <path d="M75 25l10-10M85 15l5-5" stroke="#38bdf8" />
  </svg>`,
  'lawnmower.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="25" y="45" width="50" height="25" rx="5" fill="#334155" stroke="#eab308" stroke-width="3" />
    <circle cx="35" cy="70" r="10" fill="#1e293b" />
    <circle cx="65" cy="70" r="10" fill="#1e293b" />
    <path d="M25 50h-15M10 50v-20M10 30h20M75 50l15-20M90 30h-10" />
    <path d="M50 45V20c0-3 2-5 5-5h10" stroke="#38bdf8" />
  </svg>`,
  'grinder.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="30" y="40" width="40" height="15" rx="3" transform="rotate(-30 50 47.5)" fill="#334155" />
    <circle cx="25" cy="65" r="12" stroke="#38bdf8" stroke-width="3" />
    <path d="M25 65l10-10M55 35l25-15M65 45l15 15" />
  </svg>`,
  'toolbox.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="20" y="35" width="60" height="40" rx="4" fill="#334155" />
    <path d="M40 35V25c0-2 2-4 4-4h12c2 0 4 2 4 4v10M30 55h40M30 35v40M70 35v40" />
    <rect x="45" y="48" width="10" height="8" rx="1" fill="#eab308" stroke="none" />
  </svg>`,
  'washer.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="35" y="25" width="30" height="50" rx="5" fill="#334155" />
    <circle cx="42" cy="75" r="8" fill="#1e293b" />
    <circle cx="58" cy="75" r="8" fill="#1e293b" />
    <path d="M50 25V15h-10" />
    <path d="M65 40h15v30l5 5" stroke="#38bdf8" />
  </svg>`,
  'generator.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="20" y="30" width="60" height="45" rx="5" fill="#334155" />
    <path d="M25 45h50M25 60h50M35 30V20M65 30V20M30 20h40" />
    <circle cx="50" cy="45" r="8" fill="#38bdf8" stroke="none" />
  </svg>`,
  'screwdriver.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 80l25-25M40 50l35-35M70 10l20 20L75 45" stroke="#38bdf8" />
    <rect x="15" y="75" width="15" height="15" rx="3" fill="#334155" transform="rotate(-45 22.5 82.5)" />
  </svg>`,
  'laser.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="30" y="40" width="40" height="40" rx="4" fill="#334155" />
    <circle cx="50" cy="55" r="10" fill="#ef4444" stroke="none" />
    <path d="M50 20v20M20 55h10M70 55h10" stroke="#ef4444" stroke-dasharray="4 2" />
  </svg>`,
  'default.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 70l40-40M30 30h40v40" />
  </svg>`
};

Object.entries(svgIcons).forEach(([filename, svgContent]) => {
  const filePath = path.join(imagesDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, svgContent);
  }
});

// API - Get all tools (with filters & sorting)
app.get('/api/tools', (req, res) => {
  const { category, search, status, sort } = req.query;
  let query = `
    SELECT tools.*, users.username as owner_name 
    FROM tools 
    JOIN users ON tools.owner_id = users.id 
    WHERE 1=1
  `;
  const params = [];

  if (category) {
    query += " AND tools.category = ?";
    params.push(category);
  }

  if (status) {
    query += " AND tools.status = ?";
    params.push(status);
  }

  if (search) {
    query += " AND (tools.name LIKE ? OR tools.description LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (sort === 'price_asc') {
    query += " ORDER BY tools.price ASC";
  } else if (sort === 'price_desc') {
    query += " ORDER BY tools.price DESC";
  } else {
    query += " ORDER BY tools.id DESC";
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// API - Get single tool details
app.get('/api/tools/:id', (req, res) => {
  const query = `
    SELECT tools.*, users.username as owner_name, users.email as owner_email
    FROM tools 
    JOIN users ON tools.owner_id = users.id 
    WHERE tools.id = ?
  `;
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Unealta nu a fost găsită.' });
    }
    res.json(row);
  });
});

// API - List a new tool for rental
app.post('/api/tools', (req, res) => {
  const { owner_id, name, description, category, price, image_url, health_status, maintenance_notes } = req.body;

  if (!owner_id || !name || !category || price === undefined || isNaN(price)) {
    return res.status(400).json({ error: 'Câmpuri obligatorii lipsă.' });
  }

  const finalPrice = parseFloat(price);
  if (finalPrice < 0) {
    return res.status(400).json({ error: 'Prețul nu poate fi negativ.' });
  }

  const finalImageUrl = image_url || '/images/default.svg';
  const finalHealth = health_status || 'ok';
  const finalNotes = maintenance_notes || '';

  const query = `INSERT INTO tools (owner_id, name, description, category, price, image_url, status, health_status, maintenance_notes)
                 VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?)`;

  db.run(query, [owner_id, name, description, category, finalPrice, finalImageUrl, finalHealth, finalNotes], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, message: 'Unealta a fost adăugată cu succes în registru!' });
  });
});

// API - Rent / Borrow a tool
app.post('/api/tools/:id/rent', (req, res) => {
  const toolId = req.params.id;
  const { renter_id, start_date, end_date, total_price } = req.body;

  if (!renter_id || !start_date || !end_date || total_price === undefined) {
    return res.status(400).json({ error: 'Date de închiriere incomplete.' });
  }

  db.get("SELECT * FROM tools WHERE id = ?", [toolId], (err, tool) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!tool) return res.status(404).json({ error: 'Unealta nu a fost găsită.' });
    if (tool.status !== 'available') return res.status(400).json({ error: 'Unealta este deja împrumutată.' });
    if (tool.health_status === 'maintenance' || tool.health_status === 'broken') {
      return res.status(400).json({ error: 'Această unealtă este în szerviz/reparații și nu poate fi preluată!' });
    }

    db.get("SELECT * FROM users WHERE id = ?", [renter_id], (err, renter) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!renter) return res.status(404).json({ error: 'Utilizatorul nu a fost găsit.' });

      const numTotalPrice = parseFloat(total_price);
      if (numTotalPrice > 0 && renter.balance < numTotalPrice) {
        return res.status(400).json({ error: 'Sold insuficient pentru această închiriere.' });
      }

      db.serialize(() => {
        if (numTotalPrice > 0) {
          // 1. Subtract balance from renter
          db.run("UPDATE users SET balance = balance - ? WHERE id = ?", [numTotalPrice, renter_id]);
          // 2. Add balance to owner
          db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [numTotalPrice, tool.owner_id]);
        }
        
        // 3. Update tool status to rented
        db.run("UPDATE tools SET status = 'rented' WHERE id = ?", [toolId]);
        
        // 4. Create rental entry (borrowing log)
        db.run(
          "INSERT INTO rentals (tool_id, renter_id, start_date, end_date, total_price, status) VALUES (?, ?, ?, ?, ?, 'active')",
          [toolId, renter_id, start_date, end_date, numTotalPrice],
          function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Împrumut înregistrat cu succes!', rentalId: this.lastID });
          }
        );
      });
    });
  });
});

// API - Return a rented tool
app.post('/api/rentals/:id/return', (req, res) => {
  const rentalId = req.params.id;

  db.get("SELECT * FROM rentals WHERE id = ?", [rentalId], (err, rental) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rental) return res.status(404).json({ error: 'Tranzacția de împrumut nu a fost găsită.' });
    if (rental.status === 'completed') return res.status(400).json({ error: 'Unealta a fost deja returnată.' });

    db.serialize(() => {
      // 1. Complete rental status
      db.run("UPDATE rentals SET status = 'completed' WHERE id = ?", [rentalId]);
      
      // 2. Make tool available again
      db.run("UPDATE tools SET status = 'available' WHERE id = ?", [rental.tool_id], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Unealta a fost înregistrată ca returnată și este din nou disponibilă!' });
      });
    });
  });
});

// API - Get all users
app.get('/api/users', (req, res) => {
  db.all("SELECT id, username, email, phone, balance, role FROM users", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// API - Create a new user
app.post('/api/users', (req, res) => {
  const { username, email, phone, balance, role } = req.body;

  if (!username || !email) {
    return res.status(400).json({ error: 'Numele și emailul sunt obligatorii.' });
  }

  const userBalance = balance !== undefined && !isNaN(balance) ? parseFloat(balance) : 100;
  const userRole = role === 'admin' ? 'admin' : 'user';
  const userPhone = phone || '';

  db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: 'Acest nume de utilizator există deja!' });

    const query = `INSERT INTO users (username, email, phone, balance, role) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [username, email, userPhone, userBalance, userRole], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ 
        id: this.lastID, 
        username, 
        email, 
        phone: userPhone,
        balance: userBalance, 
        role: userRole,
        message: 'Utilizatorul a fost creat cu succes!' 
      });
    });
  });
});

// API - Get single user dashboard data
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const data = {};

  db.get("SELECT id, username, email, balance, role FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Utilizatorul nu a fost găsit.' });
    
    data.user = user;

    // Get user's active/past rentals (where they borrowed something)
    const rentalsQuery = `
      SELECT rentals.*, tools.name as tool_name, tools.image_url, users.username as owner_name 
      FROM rentals 
      JOIN tools ON rentals.tool_id = tools.id
      JOIN users ON tools.owner_id = users.id
      WHERE rentals.renter_id = ?
      ORDER BY rentals.id DESC
    `;
    db.all(rentalsQuery, [userId], (err, rentals) => {
      if (err) return res.status(500).json({ error: err.message });
      data.rentals = rentals;

      // Get user's listed tools (which they offer for rent)
      db.all("SELECT * FROM tools WHERE owner_id = ? ORDER BY id DESC", [userId], (err, tools) => {
        if (err) return res.status(500).json({ error: err.message });
        data.listedTools = tools;
        
        res.json(data);
      });
    });
  });
});

// API - Add money to user balance
app.post('/api/users/:id/deposit', (req, res) => {
  const userId = req.params.id;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Sumă nevalidă.' });
  }

  db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Sold alimentat cu succes!' });
  });
});

// --- DASHBOARD & ANALYTICS ENDPOINTS ---

// GET /api/dashboard/stats - Executive Dashboard Statistics
app.get('/api/dashboard/stats', (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const stats = {
    totalTools: 0,
    availableTools: 0,
    rentedTools: 0,
    overdueCount: 0,
    totalInstallers: 0,
    installerStats: [],
    categoryStats: []
  };

  db.serialize(() => {
    db.get("SELECT COUNT(*) as total, SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) as available, SUM(CASE WHEN status='rented' THEN 1 ELSE 0 END) as rented FROM tools", [], (err, counts) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.totalTools = counts ? (counts.total || 0) : 0;
      stats.availableTools = counts ? (counts.available || 0) : 0;
      stats.rentedTools = counts ? (counts.rented || 0) : 0;

      db.get("SELECT COUNT(*) as overdue FROM rentals WHERE status = 'active' AND end_date < ?", [todayStr], (err, ovRow) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.overdueCount = ovRow ? (ovRow.overdue || 0) : 0;

        const installerQuery = `
          SELECT users.id, users.username, users.email, COUNT(rentals.id) as active_tools
          FROM users
          LEFT JOIN rentals ON users.id = rentals.renter_id AND rentals.status = 'active'
          WHERE users.username != 'Admin'
          GROUP BY users.id, users.username, users.email
          ORDER BY active_tools DESC
        `;
        db.all(installerQuery, [], (err, instRows) => {
          if (err) return res.status(500).json({ error: err.message });
          stats.totalInstallers = instRows ? instRows.length : 0;
          stats.installerStats = instRows || [];

          db.all("SELECT category, COUNT(*) as count FROM tools GROUP BY category", [], (err, catRows) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.categoryStats = catRows || [];

            stats.utilizationRate = stats.totalTools > 0 
              ? Math.round((stats.rentedTools / stats.totalTools) * 100) 
              : 0;

            const activityQuery = `
              SELECT rentals.id, 'rental' as type, tools.name as tool_name, users.username as renter_name, rentals.start_date, rentals.end_date, rentals.status, rentals.created_at
              FROM rentals
              JOIN tools ON rentals.tool_id = tools.id
              JOIN users ON rentals.renter_id = users.id
              ORDER BY rentals.id DESC LIMIT 8
            `;
            db.all(activityQuery, [], (err, actRows) => {
              stats.recentActivity = actRows || [];
              res.json(stats);
            });
          });
        });
      });
    });
  });
});

// --- CATEGORY MANAGEMENT ENDPOINTS ---

// GET /api/categories - Get all categories
app.get('/api/categories', (req, res) => {
  db.all("SELECT categories.*, COUNT(tools.id) as tool_count FROM categories LEFT JOIN tools ON categories.name = tools.category GROUP BY categories.id ORDER BY categories.name ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// POST /api/categories - Add a new category
app.post('/api/categories', (req, res) => {
  const { name, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Numele categoriei este obligatoriu.' });

  const iconUrl = icon || '/images/default.svg';
  db.run("INSERT INTO categories (name, icon) VALUES (?, ?)", [name.trim(), iconUrl], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Această categorie există deja!' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, name: name.trim(), icon: iconUrl, message: 'Categorie adăugată cu succes!' });
  });
});

// PUT /api/categories/:id - Update category
app.put('/api/categories/:id', (req, res) => {
  const catId = req.params.id;
  const { name, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Numele este obligatoriu.' });

  db.get("SELECT name FROM categories WHERE id = ?", [catId], (err, oldCat) => {
    if (err || !oldCat) return res.status(404).json({ error: 'Categorie negăsită.' });

    const oldName = oldCat.name;
    const newName = name.trim();

    db.serialize(() => {
      db.run("UPDATE categories SET name = ?, icon = ? WHERE id = ?", [newName, icon || '/images/default.svg', catId]);
      if (oldName !== newName) {
        db.run("UPDATE tools SET category = ? WHERE category = ?", [newName, oldName]);
      }
      res.json({ message: 'Categorie actualizată cu succes!' });
    });
  });
});

// DELETE /api/categories/:id - Delete category
app.delete('/api/categories/:id', (req, res) => {
  const catId = req.params.id;

  db.get("SELECT categories.name, COUNT(tools.id) as tool_count FROM categories LEFT JOIN tools ON categories.name = tools.category WHERE categories.id = ? GROUP BY categories.id", [catId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Categorie negăsită.' });
    if (row.tool_count > 0) {
      return res.status(400).json({ error: `Nu se poate șterge categoria "${row.name}" deoarece conține ${row.tool_count} utilaje.` });
    }

    db.run("DELETE FROM categories WHERE id = ?", [catId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Categorie ștearsă cu succes!' });
    });
  });
});

// --- ADMIN SPECIFIC ENDPOINTS ---

// GET /api/admin/rentals - Get master borrowing log (Who, Tool, Owner, Dates, Status)
app.get('/api/admin/rentals', (req, res) => {
  const query = `
    SELECT rentals.*, 
           tools.name as tool_name, 
           tools.image_url,
           renters.username as renter_name, 
           owners.username as owner_name
    FROM rentals
    JOIN tools ON rentals.tool_id = tools.id
    JOIN users renters ON rentals.renter_id = renters.id
    JOIN users owners ON tools.owner_id = owners.id
    ORDER BY rentals.id DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET /api/admin/tools - Get all tools in system
app.get('/api/admin/tools', (req, res) => {
  const query = `
    SELECT tools.*, users.username as owner_name
    FROM tools
    JOIN users ON tools.owner_id = users.id
    ORDER BY tools.id DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// DELETE /api/admin/tools/:id - Delete a tool from system
app.delete('/api/admin/tools/:id', (req, res) => {
  const toolId = req.params.id;
  
  db.serialize(() => {
    db.run("DELETE FROM rentals WHERE tool_id = ?", [toolId]);
    db.run("DELETE FROM tools WHERE id = ?", [toolId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Unealta a fost ștearsă cu succes din sistem!' });
    });
  });
});

// POST /api/admin/users/:id/balance - Admin edit user balance
app.post('/api/admin/users/:id/balance', (req, res) => {
  const userId = req.params.id;
  const { balance } = req.body;

  if (balance === undefined || isNaN(balance) || balance < 0) {
    return res.status(400).json({ error: 'Valoare sold nevalidă.' });
  }

  db.run("UPDATE users SET balance = ? WHERE id = ?", [balance, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: `Soldul a fost actualizat la ${balance} RON.` });
  });
});

// POST /api/admin/rentals/:id/cancel - Admin force return/end borrowing
app.post('/api/admin/rentals/:id/cancel', (req, res) => {
  const rentalId = req.params.id;

  db.get("SELECT * FROM rentals WHERE id = ?", [rentalId], (err, rental) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rental) return res.status(404).json({ error: 'Împrumutul nu există.' });

    db.serialize(() => {
      db.run("UPDATE rentals SET status = 'completed' WHERE id = ?", [rentalId]);
      db.run("UPDATE tools SET status = 'available' WHERE id = ?", [rental.tool_id], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Împrumutul a fost marcat ca returnat de către Admin!' });
      });
    });
  });
});

// PUT /api/admin/users/:id - Admin edit user details
app.put('/api/admin/users/:id', (req, res) => {
  const userId = req.params.id;
  const { username, email, phone, balance, role } = req.body;

  if (!username || !email) {
    return res.status(400).json({ error: 'Numele și emailul sunt obligatorii.' });
  }

  const userBalance = balance !== undefined && !isNaN(balance) ? parseFloat(balance) : 0;
  const userRole = role === 'admin' ? 'admin' : 'user';
  const userPhone = phone || '';

  db.get("SELECT id FROM users WHERE username = ? AND id != ?", [username, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: 'Numele de utilizator este folosit de altcineva!' });

    const query = `UPDATE users SET username = ?, email = ?, phone = ?, balance = ?, role = ? WHERE id = ?`;
    db.run(query, [username, email, userPhone, userBalance, userRole, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: `Datele utilizatorului "${username}" au fost actualizate!` });
    });
  });
});

// GET /api/export/csv - Download CSV report (tools, rentals, users)
app.get('/api/export/csv', (req, res) => {
  const type = req.query.type || 'tools';

  if (type === 'tools') {
    db.all("SELECT tools.*, users.username as owner_name FROM tools JOIN users ON tools.owner_id = users.id", [], (err, rows) => {
      if (err) return res.status(500).send('Eroare');
      let csv = 'ID,Nume Scula,Categorie,Pret Zi,Status,Stare Szerviz,Proprietar,Descriere\n';
      rows.forEach(r => {
        csv += `"${r.id}","${r.name}","${r.category}","${r.price}","${r.status}","${r.health_status || 'ok'}","${r.owner_name}","${(r.description||'').replace(/"/g, '""')}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="inventar_scule.csv"');
      res.status(200).send(csv);
    });
  } else if (type === 'rentals') {
    const query = `
      SELECT rentals.*, tools.name as tool_name, users.username as renter_name
      FROM rentals
      JOIN tools ON rentals.tool_id = tools.id
      JOIN users ON rentals.renter_id = users.id
      ORDER BY rentals.id DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) return res.status(500).send('Eroare');
      let csv = 'ID,Scula,Instalator Custode,Data Imprumut,Data Retur,Status,Pret Total\n';
      rows.forEach(r => {
        csv += `"${r.id}","${r.tool_name}","${r.renter_name}","${r.start_date}","${r.end_date}","${r.status}","${r.total_price}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="evidenta_predari.csv"');
      res.status(200).send(csv);
    });
  } else {
    db.all("SELECT id, username, email, phone, role FROM users", [], (err, rows) => {
      if (err) return res.status(500).send('Eroare');
      let csv = 'ID,Nume Instalator,Email,Telefon,Rol\n';
      rows.forEach(r => {
        csv += `"${r.id}","${r.username}","${r.email}","${r.phone||''}","${r.role}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="registru_instalatori.csv"');
      res.status(200).send(csv);
    });
  }
});

// DELETE /api/admin/users/:id - Admin delete user
app.delete('/api/admin/users/:id', (req, res) => {
  const userId = req.params.id;

  db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Utilizatorul nu există.' });
    if (user.username === 'Admin') {
      return res.status(400).json({ error: 'Nu poți șterge contul principal de Admin!' });
    }

    db.serialize(() => {
      db.run("DELETE FROM rentals WHERE renter_id = ?", [userId]);
      db.run("DELETE FROM rentals WHERE tool_id IN (SELECT id FROM tools WHERE owner_id = ?)", [userId]);
      db.run("DELETE FROM tools WHERE owner_id = ?", [userId]);
      db.run("DELETE FROM users WHERE id = ?", [userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Utilizatorul "${user.username}" a fost șters cu succes din sistem!` });
      });
    });
  });
});

// API - Extend / Prolong an active rental
app.post('/api/rentals/:id/extend', (req, res) => {
  const rentalId = req.params.id;
  const { new_end_date, additional_price } = req.body;

  if (!new_end_date || additional_price === undefined || isNaN(additional_price) || additional_price < 0) {
    return res.status(400).json({ error: 'Date de prelungire invalide.' });
  }

  db.get("SELECT rentals.*, tools.owner_id FROM rentals JOIN tools ON rentals.tool_id = tools.id WHERE rentals.id = ?", [rentalId], (err, rental) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rental) return res.status(404).json({ error: 'Împrumutul nu a fost găsit.' });
    if (rental.status !== 'active') return res.status(400).json({ error: 'Doar împrumuturile active pot fi prelungite.' });

    db.get("SELECT balance FROM users WHERE id = ?", [rental.renter_id], (err, renter) => {
      if (err) return res.status(500).json({ error: err.message });
      if (renter.balance < additional_price) {
        return res.status(400).json({ error: 'Sold insuficient pentru prelungirea împrumutului!' });
      }

      db.serialize(() => {
        db.run("UPDATE users SET balance = balance - ? WHERE id = ?", [additional_price, rental.renter_id]);
        db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [additional_price, rental.owner_id]);
        db.run("UPDATE rentals SET end_date = ?, total_price = total_price + ? WHERE id = ?", [new_end_date, additional_price, rentalId], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: `Împrumutul a fost prelungit cu succes până la data de ${new_end_date}!` });
        });
      });
    });
  });
});

// API - Get single rental contract details for printing Proces-Verbal
app.get('/api/rentals/:id/contract', (req, res) => {
  const rentalId = req.params.id;
  const query = `
    SELECT rentals.*, 
           tools.name as tool_name, 
           tools.category as tool_category, 
           tools.price as daily_price,
           tools.description as tool_description,
           renters.username as renter_name, 
           renters.email as renter_email,
           owners.username as owner_name, 
           owners.email as owner_email
    FROM rentals
    JOIN tools ON rentals.tool_id = tools.id
    JOIN users renters ON rentals.renter_id = renters.id
    JOIN users owners ON tools.owner_id = owners.id
    WHERE rentals.id = ?
  `;
  db.get(query, [rentalId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Împrumutul nu a fost găsit.' });
    res.json(row);
  });
});

// --- BACKUP & RESTORE ENDPOINTS ---

// Export all database tables as a single JSON backup object
app.get('/api/backup/export', (req, res) => {
  const backupData = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    users: [],
    tools: [],
    rentals: []
  };

  db.serialize(() => {
    db.all("SELECT * FROM users", [], (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      backupData.users = users || [];

      db.all("SELECT * FROM tools", [], (err, tools) => {
        if (err) return res.status(500).json({ error: err.message });
        backupData.tools = tools || [];

        db.all("SELECT * FROM rentals", [], (err, rentals) => {
          if (err) return res.status(500).json({ error: err.message });
          backupData.rentals = rentals || [];

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename=backup_magazie_${new Date().toISOString().split('T')[0]}.json`);
          res.json(backupData);
        });
      });
    });
  });
});

// Import and restore database from JSON backup object
app.post('/api/backup/import', (req, res) => {
  const backup = req.body;
  if (!backup || !backup.users || !backup.tools || !backup.rentals) {
    return res.status(400).json({ error: 'Fișier backup nevalid.' });
  }

  db.serialize(() => {
    db.run("DELETE FROM rentals");
    db.run("DELETE FROM tools");
    db.run("DELETE FROM users");

    const stmtUser = db.prepare("INSERT INTO users (id, username, email, balance, role) VALUES (?, ?, ?, ?, ?)");
    backup.users.forEach(u => {
      stmtUser.run(u.id, u.username, u.email, u.balance, u.role);
    });
    stmtUser.finalize();

    const stmtTool = db.prepare("INSERT INTO tools (id, owner_id, name, description, category, price, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    backup.tools.forEach(t => {
      stmtTool.run(t.id, t.owner_id, t.name, t.description, t.category, t.price, t.image_url, t.status);
    });
    stmtTool.finalize();

    const stmtRental = db.prepare("INSERT INTO rentals (id, tool_id, renter_id, start_date, end_date, total_price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    backup.rentals.forEach(r => {
      stmtRental.run(r.id, r.tool_id, r.renter_id, r.start_date, r.end_date, r.total_price, r.status, r.created_at || new Date().toISOString());
    });
    stmtRental.finalize();

    res.json({ message: 'Restaurare backup completată cu succes!' });
  });
});

// Fallback to index.html for SPA router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`To access from other devices on the same Wi-Fi, use your local IP.`);
  });
}

module.exports = app;
