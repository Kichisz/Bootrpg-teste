const { getDb } = require('../database/dbConnection');

function salvarSubtiposLote(userId, sistema, nomeLista, itens) {
    const db = getDb();
    const stmt = db.prepare(`
        INSERT INTO subtipos_salvaguarda (nomeLista, tipo, subtipo, descricao, sistema, userId)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((arr) => {
        for (const item of arr) {
            stmt.run(nomeLista, item.tipo, item.subtipo, item.descricao, sistema, userId);
        }
    });

    insertMany(itens);
    db.close();
}

module.exports = { salvarSubtiposLote };