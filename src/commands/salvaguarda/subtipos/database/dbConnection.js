const Database = require('better-sqlite3');
const path = require('path');

function getDb() {
    const dbPath = path.resolve('subtipo-database.sqlite');
    const db = new Database(dbPath);
    
    // Tabela de subtipos
    db.prepare(`
        CREATE TABLE IF NOT EXISTS subtipos_salvaguarda (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nomeLista TEXT,
            tipo TEXT,
            subtipo TEXT,
            descricao TEXT,
            sistema TEXT,
            userId TEXT
        )
    `).run();

    // 🌟 NOVO: Tabela para guardar qual lista está ativa por sistema
    db.prepare(`
        CREATE TABLE IF NOT EXISTS lista_ativa_salvaguarda (
            sistema TEXT PRIMARY KEY,
            nomeLista TEXT,
            userId TEXT
        )
    `).run();

    return db;
}

// 🌟 FUNÇÃO PÚBLICA: Use esta função no seu comando de Magias para puxar os subtipos ativos do sistema
function obterListaAtiva(sistema) {
    const db = getDb();
    const ativa = db.prepare('SELECT nomeLista FROM lista_ativa_salvaguarda WHERE sistema = ?').get(sistema);
    
    if (!ativa) {
        db.close();
        return { nomeLista: null, itens: [] };
    }

    const itens = db.prepare('SELECT * FROM subtipos_salvaguarda WHERE sistema = ? AND nomeLista = ?').all(sistema, ativa.nomeLista);
    db.close();

    return {
        nomeLista: ativa.nomeLista,
        itens: itens // Retorna todos os subtipos, tipos e descrições prontos para uso nas magias
    };
}

module.exports = { getDb, obterListaAtiva };