const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve('database-fichas.sqlite');
const db = new Database(dbPath);

db.prepare(`
    CREATE TABLE IF NOT EXISTS fichas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        avatarNome TEXT,
        sistemaNome TEXT,
        tipoPersonagem TEXT,
        nomePersonagem TEXT,
        dadosJson TEXT
    )
`).run();

function getSistemaAtivo() {
    try {
        const activeDbPath = path.resolve('sistemaativo-database.sqlite');
        if (!fs.existsSync(activeDbPath)) return null;
        
        const activeDb = new Database(activeDbPath, { readonly: true });
        const row = activeDb.prepare('SELECT conteudo_json FROM sistema_ativo LIMIT 1').get();
        activeDb.close();

        if (!row || !row.conteudo_json) return null;
        return JSON.parse(row.conteudo_json);
    } catch (err) {
        return null;
    }
}

function verificarFichaExistente(userId, avatarNome, sistemaNome) {
    const stmt = db.prepare(`
        SELECT id FROM fichas 
        WHERE userId = ? 
          AND LOWER(TRIM(avatarNome)) = LOWER(TRIM(?)) 
          AND LOWER(TRIM(sistemaNome)) = LOWER(TRIM(?))
    `);
    return stmt.get(userId, avatarNome, sistemaNome);
}

function salvarFichaNoBanco(userId, avatarNome, sistemaNome, tipoPersonagem, nomePersonagem, dadosObj) {
    const stmt = db.prepare(`
        INSERT INTO fichas (userId, avatarNome, sistemaNome, tipoPersonagem, nomePersonagem, dadosJson)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(userId, avatarNome, sistemaNome, tipoPersonagem, nomePersonagem, JSON.stringify(dadosObj));
}

function buscarAvataresDoUsuario(userId) {
    try {
        const avatarDbPath = path.resolve('database-avatares.sqlite');
        if (!fs.existsSync(avatarDbPath)) return [];
        const avatarDb = new Database(avatarDbPath, { readonly: true });
        const avatares = avatarDb.prepare('SELECT nome FROM avatares WHERE userId = ?').all(userId);
        avatarDb.close();
        return avatares.map(a => a.nome);
    } catch (e) {
        return [];
    }
}

module.exports = {
    db,
    getSistemaAtivo,
    verificarFichaExistente,
    salvarFichaNoBanco,
    buscarAvataresDoUsuario
};