const Database = require('better-sqlite3');
const path = require('path');

function getSistemaAtivo() {
    try {
        const dbAtivo = new Database(path.resolve('sistemaativo-database.sqlite'), { readonly: true });
        const row = dbAtivo.prepare('SELECT conteudo_json FROM sistema_ativo').get();
        dbAtivo.close();
        if (!row) return null;
        return JSON.parse(row.conteudo_json);
    } catch (err) {
        return null;
    }
}

function getConfigDb() {
    const db = new Database('sistemainventarioconfig-database.sqlite');
    db.prepare(`
        CREATE TABLE IF NOT EXISTS inventario_config (
            sistema_nome TEXT PRIMARY KEY,
            config_json TEXT
        )
    `).run();
    return db;
}

function getPesoDb() {
    const db = new Database('pesoconfig-database.sqlite');
    db.prepare(`
        CREATE TABLE IF NOT EXISTS peso_config (
            sistema_nome TEXT PRIMARY KEY,
            peso_json TEXT
        )
    `).run();
    return db;
}

function salvarConfigSistema(sistemaNome, configData) {
    const db = getConfigDb();
    db.prepare(`
        INSERT INTO inventario_config (sistema_nome, config_json) 
        VALUES (?, ?) 
        ON CONFLICT(sistema_nome) DO UPDATE SET config_json = excluded.config_json
    `).run(sistemaNome, JSON.stringify(configData));
    db.close();
}

function carregarConfigSistema(sistemaNome) {
    const db = getConfigDb();
    const row = db.prepare('SELECT config_json FROM inventario_config WHERE sistema_nome = ?').get(sistemaNome);
    db.close();
    return row ? JSON.parse(row.config_json) : null;
}

function salvarPesoSistema(sistemaNome, pesoData) {
    const db = getPesoDb();
    db.prepare(`
        INSERT INTO peso_config (sistema_nome, peso_json) 
        VALUES (?, ?) 
        ON CONFLICT(sistema_nome) DO UPDATE SET peso_json = excluded.peso_json
    `).run(sistemaNome, JSON.stringify(pesoData));
    db.close();
}

function carregarPesoSistema(sistemaNome) {
    const db = getPesoDb();
    const row = db.prepare('SELECT peso_json FROM peso_config WHERE sistema_nome = ?').get(sistemaNome);
    db.close();
    return row ? JSON.parse(row.peso_json) : null;
}

module.exports = {
    getSistemaAtivo,
    salvarConfigSistema,
    carregarConfigSistema,
    salvarPesoSistema,
    carregarPesoSistema
};