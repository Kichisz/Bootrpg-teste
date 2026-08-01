const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

db.exec(`
    CREATE TABLE IF NOT EXISTS tuppers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        guildId TEXT,
        nome TEXT,
        prefixo TEXT,
        fotoUrl TEXT,
        isGlobal INTEGER DEFAULT 1,
        isPublic INTEGER DEFAULT 1,
        createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS active_channels (
        guildId TEXT,
        channelId TEXT,
        PRIMARY KEY (guildId, channelId)
    );

    CREATE TABLE IF NOT EXISTS active_tuppers (
        userId TEXT,
        guildId TEXT,
        tupperId INTEGER,
        PRIMARY KEY (userId, guildId)
    );

    CREATE TABLE IF NOT EXISTS rpg_systems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        guildId TEXT,
        nomeSistema TEXT,
        config TEXT,
        createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS guild_active_system (
        guildId TEXT PRIMARY KEY,
        systemId INTEGER
    );

    CREATE TABLE IF NOT EXISTS system_shares (
        senderId TEXT,
        targetId TEXT,
        systemId INTEGER,
        timestamp INTEGER
    );
`);

try { db.exec("ALTER TABLE tuppers ADD COLUMN isPublic INTEGER DEFAULT 1;"); } catch (e) {}
try { db.exec("ALTER TABLE tuppers ADD COLUMN createdAt TEXT;"); } catch (e) {}

module.exports = db;