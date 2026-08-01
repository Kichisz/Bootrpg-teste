const Database = require('better-sqlite3');
const path = require('path');

const itensDb = new Database(path.join(__dirname, '../../../../Itenstabela-database.sqlite'));
const armasDb = new Database(path.join(__dirname, '../../../../Armastabela-database.sqlite'));
const armadurasDb = new Database(path.join(__dirname, '../../../../Armadurasstabela-database.sqlite'));

// Inicializa tabelas com peso REAL (suporte a decimais)
itensDb.prepare(`
    CREATE TABLE IF NOT EXISTS itens (
        id INTEGER PRIMARY KEY,
        userId TEXT,
        guildId TEXT,
        systemName TEXT,
        nome TEXT,
        peso REAL
    )
`).run();

armasDb.prepare(`
    CREATE TABLE IF NOT EXISTS armas (
        id INTEGER PRIMARY KEY,
        userId TEXT,
        guildId TEXT,
        systemName TEXT,
        nome TEXT,
        dadoDano TEXT,
        bonusDano TEXT,
        descricao TEXT,
        estilo TEXT,
        peso REAL
    )
`).run();

armadurasDb.prepare(`
    CREATE TABLE IF NOT EXISTS armaduras (
        id INTEGER PRIMARY KEY,
        userId TEXT,
        guildId TEXT,
        systemName TEXT,
        nome TEXT,
        bonusCa TEXT,
        penalidadeDestreza TEXT,
        descricao TEXT,
        peso REAL
    )
`).run();

// Função utilitária para gerar ID extremamente único em todas as tabelas
function gerarIdUnico() {
    let id;
    let existe = true;

    while (existe) {
        id = Math.floor(Math.random() * 9989999) + 10000;

        const checkItem = itensDb.prepare('SELECT id FROM itens WHERE id = ?').get(id);
        const checkArma = armasDb.prepare('SELECT id FROM armas WHERE id = ?').get(id);
        const checkArmadura = armadurasDb.prepare('SELECT id FROM armaduras WHERE id = ?').get(id);

        if (!checkItem && !checkArma && !checkArmadura) {
            existe = false;
        }
    }
    return id;
}

module.exports = { itensDb, armasDb, armadurasDb, gerarIdUnico };