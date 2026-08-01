const Database = require('better-sqlite3');
const path = require('path');

function getSalvaguardaDb() {
    const dbPath = path.resolve(process.cwd(), 'salvaguarda-config.sqlite');
    const db = new Database(dbPath);
    db.prepare(`
        CREATE TABLE IF NOT EXISTS salvaguarda_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guildId TEXT,
            userId TEXT,
            sistemaNome TEXT,
            avatarNome TEXT,
            fichaId TEXT,
            subtipoChave TEXT,
            configJson TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
    return db;
}

function getSalvaguardaNpcsDb() {
    const dbPath = path.resolve(process.cwd(), 'salvaguardanpcs-database.sqlite');
    const db = new Database(dbPath);
    db.prepare(`
        CREATE TABLE IF NOT EXISTS salvaguardanpcs_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guildId TEXT,
            userId TEXT,
            sistemaNome TEXT,
            subtipoChave TEXT,
            configJson TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
    return db;
}

module.exports = { getSalvaguardaDb, getSalvaguardaNpcsDb };