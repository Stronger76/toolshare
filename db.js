const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'toolshare.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT,
      balance REAL DEFAULT 200,
      role TEXT DEFAULT 'user'
    )`);

    // Tools table (Pure rental/borrowing)
    db.run(`CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER,
      name TEXT,
      description TEXT,
      category TEXT,
      price REAL, -- Daily rental rate
      image_url TEXT,
      status TEXT DEFAULT 'available', -- 'available', 'rented'
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )`);

    // Rentals table (Master borrowing log: Who, When borrowed, When expected return)
    db.run(`CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER,
      renter_id INTEGER,
      start_date TEXT,
      end_date TEXT,
      total_price REAL,
      status TEXT DEFAULT 'active', -- 'active', 'completed'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tool_id) REFERENCES tools(id),
      FOREIGN KEY (renter_id) REFERENCES users(id)
    )`);

    // Categories table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      icon TEXT DEFAULT '/images/default.svg'
    )`);

    // Safe DB Migrations for Enterprise extensions
    db.run("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''", (err) => {});
    db.run("ALTER TABLE tools ADD COLUMN health_status TEXT DEFAULT 'ok'", (err) => {});
    db.run("ALTER TABLE tools ADD COLUMN maintenance_notes TEXT DEFAULT ''", (err) => {});

    // Seed default categories
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

    // Seed data
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

                    // Tool 1
                    insertTool.run(
                      andrei.id, 
                      "Ciocan Rotopercutor Bosch 800W", 
                      "Ciocan rotopercutor profesional pentru găurit și dăltuit în beton. Include mandrină SDS-Plus, valiză de transport și burghie.", 
                      "Scule electrice", 
                      50, 
                      "/images/drill.svg", 
                      "available"
                    );

                    // Tool 2
                    insertTool.run(
                      elena.id, 
                      "Mașină de tuns iarba Makita", 
                      "Mașină de tuns iarba puternică pe benzină pentru grădini medii și mari. Dispune de coș colector de iarbă și înălțime de tăiere reglabilă.", 
                      "Scule pentru grădină", 
                      70, 
                      "/images/lawnmower.svg", 
                      "available"
                    );

                    // Tool 3
                    insertTool.run(
                      maria.id, 
                      "Polizor Unghiular Dewalt 125mm", 
                      "Polizor unghiular (flex) compact de 900W. Se oferă cu discuri de tăiere metal și apărătoare reglabilă.", 
                      "Scule electrice", 
                      40, 
                      "/images/grinder.svg", 
                      "available"
                    );

                    // Tool 4
                    insertTool.run(
                      andrei.id, 
                      "Trusă de scule 108 piese", 
                      "Set complet de chei tubulare și biți într-o cutie rezistentă de plastic. Fabricat din oțel crom-vanadiu de înaltă calitate.", 
                      "Unelte de mână", 
                      30, 
                      "/images/toolbox.svg", 
                      "available"
                    );

                    // Tool 5
                    insertTool.run(
                      elena.id, 
                      "Aparat de spălat cu presiune Kärcher", 
                      "Aparat de spălat cu înaltă presiune Kärcher K4 cu lance de curățare a terasei și jet de apă reglabil.", 
                      "Scule pentru grădină", 
                      90, 
                      "/images/washer.svg", 
                      "available"
                    );

                    insertTool.finalize();
                    console.log('Pure rental seed data inserted.');
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
