const path = require('path');
const { Pool } = require('pg');

const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const isPostgres = !!dbUrl;

let db;

if (isPostgres) {
  console.log('Connecting to PostgreSQL database using Vercel integration url...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  function convertSql(sql) {
    let index = 1;
    let converted = sql
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      .replace(/REAL/gi, 'DOUBLE PRECISION')
      .replace(/CURRENT_TIMESTAMP/gi, 'NOW()')
      .replace(/\?/g, () => `$${index++}`);
    return converted;
  }

  db = {
    serialize: (callback) => {
      callback();
    },
    run: function(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      let pgSql = convertSql(sql);
      let isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
        pgSql += ' RETURNING id';
      }

      pool.query(pgSql, params, (err, res) => {
        if (err) {
          if (callback) callback(err);
          return;
        }
        const context = {
          lastID: (isInsert && res.rows && res.rows[0]) ? res.rows[0].id : null,
          changes: res.rowCount
        };
        if (callback) {
          callback.call(context, null);
        }
      });
    },
    get: function(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      const pgSql = convertSql(sql);
      pool.query(pgSql, params, (err, res) => {
        if (err) {
          if (callback) callback(err);
          return;
        }
        if (callback) {
          callback(null, res.rows[0]);
        }
      });
    },
    all: function(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      const pgSql = convertSql(sql);
      pool.query(pgSql, params, (err, res) => {
        if (err) {
          if (callback) callback(err);
          return;
        }
        if (callback) {
          callback(null, res.rows);
        }
      });
    },
    prepare: function(sql) {
      const pgSql = convertSql(sql);
      return {
        run: function(...args) {
          let callback;
          if (typeof args[args.length - 1] === 'function') {
            callback = args.pop();
          }
          pool.query(pgSql, args, (err, res) => {
            if (callback) callback(err);
          });
        },
        finalize: function() {
          // No-op
        }
      };
    }
  };

  initializePostgresDatabase();
} else {
  const sqlite3 = require('sqlite3').verbose();
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
}

function initializePostgresDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE,
      email VARCHAR(255),
      phone VARCHAR(50) DEFAULT '',
      balance DOUBLE PRECISION DEFAULT 200,
      role VARCHAR(50) DEFAULT 'user'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tools (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255),
      description TEXT,
      category VARCHAR(255),
      price DOUBLE PRECISION,
      image_url TEXT,
      status VARCHAR(50) DEFAULT 'available',
      health_status VARCHAR(50) DEFAULT 'ok',
      maintenance_notes TEXT DEFAULT ''
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rentals (
      id SERIAL PRIMARY KEY,
      tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE,
      renter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      start_date VARCHAR(50),
      end_date VARCHAR(50),
      total_price DOUBLE PRECISION,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE,
      icon VARCHAR(255) DEFAULT '/images/default.svg'
    )`);

    db.get("SELECT COUNT(*) as count FROM categories", [], (err, row) => {
      if (row && parseInt(row.count) === 0) {
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
      if (row && parseInt(row.count) === 0) {
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

function initializeSQLiteDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT,
      phone TEXT DEFAULT '',
      balance REAL DEFAULT 200,
      role TEXT DEFAULT 'user'
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
