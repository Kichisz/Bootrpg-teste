const Database = require('better-sqlite3');
const path = require('path');

// Força a criação e leitura do banco EXCLUSIVAMENTE na pasta raiz do projeto
const dbPath = path.join(process.cwd(), 'database-sistemas.sqlite');
const db = new Database(dbPath);

// Criação das tabelas padrão se não existirem
db.exec(`
    CREATE TABLE IF NOT EXISTS rpg_systems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        nomeSistema TEXT,
        config TEXT
    );
    CREATE TABLE IF NOT EXISTS guild_active_system (
        guildId TEXT PRIMARY KEY,
        systemId TEXT
    );
`);

module.exports = db;