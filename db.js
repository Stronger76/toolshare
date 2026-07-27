const path = require('path');
const { Pool } = require('pg');

// Bypass self-signed certificate issues for hosted Postgres database connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const isPostgres = !!dbUrl;

let db;
let dbReady;

if (isPostgres) {
  console.log('Connecting to PostgreSQL (Supabase)...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  // Helper: convert SQLite-style ? params to PostgreSQL $1,$2,...
  function convertSql(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  db = {
    serialize: (cb) => cb(),
    run: function(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      if (!Array.isArray(params)) params = [];
      let pgSql = convertSql(sql);
      const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
        pgSql += ' RETURNING id';
      }
      pool.query(pgSql, params, (err, res) => {
        if (err) { console.error('PG run error:', err.message, '| SQL:', pgSql); if (callback) callback(err); return; }
        const ctx = { lastID: (isInsert && res.rows && res.rows[0]) ? res.rows[0].id : null, changes: res.rowCount };
        if (callback) callback.call(ctx, null);
      });
    },
    get: function(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      if (!Array.isArray(params)) params = [];
      const pgSql = convertSql(sql);
      pool.query(pgSql, params, (err, res) => {
        if (err) { console.error('PG get error:', err.message, '| SQL:', pgSql); if (callback) callback(err); return; }
        if (callback) callback(null, res.rows[0]);
      });
    },
    all: function(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      if (!Array.isArray(params)) params = [];
      const pgSql = convertSql(sql);
      pool.query(pgSql, params, (err, res) => {
        if (err) { console.error('PG all error:', err.message, '| SQL:', pgSql); if (callback) callback(err); return; }
        if (callback) callback(null, res.rows);
      });
    },
    prepare: function(sql) {
      const pgSql = convertSql(sql);
      return {
        run: function(...args) {
          let callback;
          if (typeof args[args.length - 1] === 'function') callback = args.pop();
          pool.query(pgSql, args, (err) => { if (callback) callback(err); });
        },
        finalize: function() {}
      };
    }
  };

  // Async initialization — creates tables and seeds data, resolves when done
  dbReady = (async () => {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        username VARCHAR(255) UNIQUE,
        password VARCHAR(255)
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        email VARCHAR(255),
        phone VARCHAR(50) DEFAULT '',
        balance DOUBLE PRECISION DEFAULT 200,
        role VARCHAR(50) DEFAULT 'user',
        location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS tools (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255),
        description TEXT,
        category VARCHAR(255),
        price DOUBLE PRECISION,
        image_url TEXT,
        status VARCHAR(50) DEFAULT 'available',
        health_status VARCHAR(50) DEFAULT 'ok',
        maintenance_notes TEXT DEFAULT '',
        location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS rentals (
        id SERIAL PRIMARY KEY,
        tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE,
        renter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_date VARCHAR(50),
        end_date VARCHAR(50),
        total_price DOUBLE PRECISION,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE,
        icon VARCHAR(255) DEFAULT '/images/default.svg'
      )`);

      // Ensure columns exist on tables for migrations
      try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL`); } catch(e){}
      try { await pool.query(`ALTER TABLE tools ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL`); } catch(e){}
      try { await pool.query(`ALTER TABLE rentals ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL`); } catch(e){}

      console.log('PostgreSQL tables created successfully.');

      // Clean and seed locations to ensure exact IDs (1 and 2)
      await pool.query("DELETE FROM locations");
      try { await pool.query("ALTER SEQUENCE locations_id_seq RESTART WITH 1"); } catch(e){}
      
      // instal / Olecom2026+: 187f3f71a80329146ff6c0d7f63d39649e158f518e2107b698ad4d30e8911b81
      // depozit / Olecom2026: 2b2d58f56e3a15d4dffbaf3a015b1fc75b4f394f0f371e07d7fea88fdc4b56e4
      await pool.query("INSERT INTO locations (name, username, password) VALUES ('instal', 'instal', '187f3f71a80329146ff6c0d7f63d39649e158f518e2107b698ad4d30e8911b81')");
      await pool.query("INSERT INTO locations (name, username, password) VALUES ('depozit', 'depozit', '2b2d58f56e3a15d4dffbaf3a015b1fc75b4f394f0f371e07d7fea88fdc4b56e4')");
      console.log('Seeded locations.');

      // Assign existing records to default location
      const firstLoc = await pool.query("SELECT id FROM locations ORDER BY id ASC LIMIT 1");
      if (firstLoc.rows.length > 0) {
        const defaultLocId = firstLoc.rows[0].id;
        await pool.query("UPDATE users SET location_id = $1 WHERE location_id IS NULL", [defaultLocId]);
        await pool.query("UPDATE tools SET location_id = $1 WHERE location_id IS NULL", [defaultLocId]);
        await pool.query("UPDATE rentals SET location_id = $1 WHERE location_id IS NULL", [defaultLocId]);
      }

      // Seed categories
      const catCount = await pool.query("SELECT COUNT(*) as count FROM categories");
      if (parseInt(catCount.rows[0].count) === 0) {
        const cats = [
          ["Scule electrice", "/images/drill.svg"],
          ["Unelte de mână", "/images/toolbox.svg"],
          ["Scule pentru grădină", "/images/lawnmower.svg"],
          ["Instrumente de măsură", "/images/default.svg"],
          ["Instalații Sanitare", "/images/default.svg"],
          ["Climatizare & Ventilație", "/images/default.svg"],
          ["Altele", "/images/default.svg"]
        ];
        for (const [name, icon] of cats) {
          await pool.query("INSERT INTO categories (name, icon) VALUES ($1, $2)", [name, icon]);
        }
        console.log('Seeded categories.');
      }

      // Seed users & tools
      const userCount = await pool.query("SELECT COUNT(*) as count FROM users");
      if (parseInt(userCount.rows[0].count) === 0) {
        await pool.query("INSERT INTO users (username, email, balance, role) VALUES ('Admin', 'admin@toolshare.ro', 1000, 'admin')");
        const r1 = await pool.query("INSERT INTO users (username, email, balance, role) VALUES ('Andrei Ionescu', 'andrei@example.com', 500, 'user') RETURNING id");
        const r2 = await pool.query("INSERT INTO users (username, email, balance, role) VALUES ('Maria Popescu', 'maria@example.com', 150, 'user') RETURNING id");
        const r3 = await pool.query("INSERT INTO users (username, email, balance, role) VALUES ('Elena Dumitrescu', 'elena@example.com', 300, 'user') RETURNING id");

        const andrei = r1.rows[0].id;
        const maria = r2.rows[0].id;
        const elena = r3.rows[0].id;

        await pool.query("INSERT INTO tools (owner_id, name, description, category, price, image_url, status) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [andrei, "Ciocan Rotopercutor Bosch 800W", "Ciocan rotopercutor profesional pentru găurit.", "Scule electrice", 50, "/images/drill.svg", "available"]);
        await pool.query("INSERT INTO tools (owner_id, name, description, category, price, image_url, status) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [elena, "Mașină de tuns iarba Makita", "Mașină de tuns iarba pe benzină.", "Scule pentru grădină", 70, "/images/lawnmower.svg", "available"]);
        await pool.query("INSERT INTO tools (owner_id, name, description, category, price, image_url, status) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [maria, "Polizor Unghiular Dewalt 125mm", "Polizor unghiular.", "Scule electrice", 40, "/images/grinder.svg", "available"]);
        await pool.query("INSERT INTO tools (owner_id, name, description, category, price, image_url, status) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [andrei, "Trusă de scule 108 piese", "Set complet de chei.", "Unelte de mână", 30, "/images/toolbox.svg", "available"]);
        await pool.query("INSERT INTO tools (owner_id, name, description, category, price, image_url, status) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [elena, "Aparat de spălat cu presiune Kärcher", "Aparat spălat.", "Scule pentru grădină", 90, "/images/washer.svg", "available"]);

        console.log('Seeded users and tools.');
      }

      console.log('PostgreSQL database ready.');
    } catch (err) {
      console.error('PostgreSQL init error:', err);
    }
  })();

} else {
  try {
    const sqlite3 = require(/* webpackIgnore: true */ 'sqlite3').verbose();
    const dbPath = path.join(__dirname, 'toolshare.db');
    const sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database', err.message);
      } else {
        console.log('Connected to the SQLite database.');
        initializeSQLiteDatabase();
      }
    });
    db = sqliteDb;
  } catch (e) {
    console.error('SQLite3 not available. Set POSTGRES_URL or DATABASE_URL for cloud deployment.');
    process.exit(1);
  }
  dbReady = Promise.resolve();
}

function initializeSQLiteDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      username TEXT UNIQUE,
      password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT,
      phone TEXT DEFAULT '',
      balance REAL DEFAULT 200,
      role TEXT DEFAULT 'user',
      location_id INTEGER REFERENCES locations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER,
      name TEXT,
      description TEXT,
      category TEXT,
      price REAL,
      image_url TEXT,
      status TEXT DEFAULT 'available',
      health_status TEXT DEFAULT 'ok',
      maintenance_notes TEXT DEFAULT '',
      location_id INTEGER REFERENCES locations(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER,
      renter_id INTEGER,
      start_date TEXT,
      end_date TEXT,
      total_price REAL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      location_id INTEGER REFERENCES locations(id),
      FOREIGN KEY (tool_id) REFERENCES tools(id),
      FOREIGN KEY (renter_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      icon TEXT DEFAULT '/images/default.svg'
    )`);

    db.run("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''", (err) => {});
    db.run("ALTER TABLE tools ADD COLUMN health_status TEXT DEFAULT 'ok'", (err) => {});
    db.run("ALTER TABLE tools ADD COLUMN maintenance_notes TEXT DEFAULT ''", (err) => {});
    db.run("ALTER TABLE users ADD COLUMN location_id INTEGER REFERENCES locations(id)", (err) => {});
    db.run("ALTER TABLE tools ADD COLUMN location_id INTEGER REFERENCES locations(id)", (err) => {});
    db.run("ALTER TABLE rentals ADD COLUMN location_id INTEGER REFERENCES locations(id)", (err) => {});

    // Clean and seed locations in SQLite to guarantee exact IDs (1 and 2)
    db.run("DELETE FROM locations", [], () => {
      db.run("DELETE FROM sqlite_sequence WHERE name='locations'", [], () => {
        db.run("INSERT INTO locations (name, username, password) VALUES ('instal', 'instal', '187f3f71a80329146ff6c0d7f63d39649e158f518e2107b698ad4d30e8911b81')", () => {
          db.run("INSERT INTO locations (name, username, password) VALUES ('depozit', 'depozit', '2b2d58f56e3a15d4dffbaf3a015b1fc75b4f394f0f371e07d7fea88fdc4b56e4')", () => {
            // Assign existing to first location
            db.get("SELECT id FROM locations ORDER BY id ASC LIMIT 1", [], (err, locRow) => {
              if (locRow) {
                const defaultLocId = locRow.id;
                db.run("UPDATE users SET location_id = ? WHERE location_id IS NULL", [defaultLocId]);
                db.run("UPDATE tools SET location_id = ? WHERE location_id IS NULL", [defaultLocId]);
                db.run("UPDATE rentals SET location_id = ? WHERE location_id IS NULL", [defaultLocId]);
              }
            });
          });
        });
      });
    });

    db.get("SELECT COUNT(*) as count FROM categories", [], (err, row) => {
      if (row && row.count === 0) {
        const stmt = db.prepare("INSERT INTO categories (name, icon) VALUES (?, ?)");
        stmt.run("Scule electrice", "/images/drill.svg");
        stmt.run("Unelte de mână", "/images/toolbox.svg");
        stmt.run("Scule pentru grădină", "/images/lawnmower.svg");
        stmt.run("Instrumente de măsură", "/images/default.svg");
        stmt.run("Instalații Sanitare", "/images/default.svg");
        stmt.run("Climatizare & Ventilație", "/images/default.svg");
        stmt.run("Altele", "/images/default.svg");
        stmt.finalize();
      }
    });

    db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
      if (row && row.count === 0) {
        db.run("INSERT INTO users (username, email, balance, role) VALUES ('Admin', 'admin@toolshare.ro', 1000, 'admin')", () => {
          db.run("INSERT INTO users (username, email, balance, role) VALUES ('Andrei Ionescu', 'andrei@example.com', 500, 'user')", () => {
            db.run("INSERT INTO users (username, email, balance, role) VALUES ('Maria Popescu', 'maria@example.com', 150, 'user')", () => {
              db.run("INSERT INTO users (username, email, balance, role) VALUES ('Elena Dumitrescu', 'elena@example.com', 300, 'user')", () => {
                db.all("SELECT id, username FROM users", [], (err, users) => {
                  if (users && users.length > 0) {
                    const andrei = users.find(u => u.username === "Andrei Ionescu");
                    const maria = users.find(u => u.username === "Maria Popescu");
                    const elena = users.find(u => u.username === "Elena Dumitrescu");

                    const insertTool = db.prepare(`INSERT INTO tools 
                      (owner_id, name, description, category, price, image_url, status) 
                      VALUES (?, ?, ?, ?, ?, ?, ?)`);

                    insertTool.run(andrei.id, "Ciocan Rotopercutor Bosch 800W", "Ciocan rotopercutor profesional pentru găurit.", "Scule electrice", 50, "/images/drill.svg", "available");
                    insertTool.run(elena.id, "Mașină de tuns iarba Makita", "Mașină de tuns iarba pe benzină.", "Scule pentru grădină", 70, "/images/lawnmower.svg", "available");
                    insertTool.run(maria.id, "Polizor Unghiular Dewalt 125mm", "Polizor unghiular.", "Scule electrice", 40, "/images/grinder.svg", "available");
                    insertTool.run(andrei.id, "Trusă de scule 108 piese", "Set complet de chei.", "Unelte de mână", 30, "/images/toolbox.svg", "available");
                    insertTool.run(elena.id, "Aparat de spălat cu presiune Kärcher", "Aparat spălat.", "Scule pentru grădină", 90, "/images/washer.svg", "available");
                    insertTool.finalize();
                  }
                });
              });
            });
          });
        });
      }
    });
  });
}

module.exports = db;
module.exports.dbReady = dbReady;
