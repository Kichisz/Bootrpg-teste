const Database = require('better-sqlite3');
const path = require('path');

function obterSistemaAtivo() {
    try {
        const dbPath = path.resolve(process.cwd(), 'sistemaativo-database.sqlite');
        const db = new Database(dbPath, { readonly: true });
        
        const row = db.prepare('SELECT conteudo_json FROM sistema_ativo LIMIT 1').get();
        db.close();

        if (row && row.conteudo_json) {
            const sistemaObj = JSON.parse(row.conteudo_json);
            return sistemaObj?.nomeSistema || sistemaObj?.nome || sistemaObj?.sistema || null;
        }
        return null;
    } catch (e) {
        return null;
    }
}

module.exports = { obterSistemaAtivo };