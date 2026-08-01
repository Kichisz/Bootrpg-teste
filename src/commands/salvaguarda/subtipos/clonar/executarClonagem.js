const { getDb } = require('../database/dbConnection');

function executarCopiaClonagem(userId, sistemaOrigem, listaOrigem, sistemaAtual) {
    const db = getDb();
    
    db.prepare('DELETE FROM subtipos_salvaguarda WHERE sistema = ? AND userId = ?').run(sistemaAtual, userId);

    const itensOrigem = db.prepare('SELECT nomeLista, tipo, subtipo, descricao FROM subtipos_salvaguarda WHERE sistema = ? AND nomeLista = ? AND userId = ?').all(sistemaOrigem, listaOrigem, userId);

    const stmt = db.prepare(`
        INSERT INTO subtipos_salvaguarda (nomeLista, tipo, subtipo, descricao, sistema, userId)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const trans = db.transaction((arr) => {
        for (const item of arr) {
            stmt.run(item.nomeLista, item.tipo, item.subtipo, item.descricao, sistemaAtual, userId);
        }
    });

    trans(itensOrigem);
    db.close();
}

module.exports = { executarCopiaClonagem };