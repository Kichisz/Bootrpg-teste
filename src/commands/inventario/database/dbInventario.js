const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve('inventarioplayers-database.sqlite');

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const dbInstance = new Database(dbPath);

dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS inventario_jogadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        fichaId TEXT NOT NULL,
        sistemaNome TEXT NOT NULL,
        dadosInventario TEXT DEFAULT '{}',
        UNIQUE(userId, fichaId, sistemaNome)
    );

    CREATE TABLE IF NOT EXISTS inventario_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fichaId TEXT,
        tipo TEXT,
        itemId TEXT,
        nome TEXT,
        quantia INTEGER,
        peso REAL,
        dadoDano TEXT,
        bonusDano TEXT,
        bonusCa TEXT,
        penalidadeDestreza TEXT,
        descricao TEXT,
        equipado INTEGER DEFAULT 0
    );
`);

console.log('[Banco de Dados] 📦 Arquivo "inventarioplayers-database.sqlite" verificado e inicializado com sucesso.');

module.exports = dbInstance;