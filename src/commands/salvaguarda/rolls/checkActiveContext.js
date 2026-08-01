const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function obterContextoAtivo(userId, guildId) {
    try {
        // 1. Busca o sistema ativo no servidor
        const activeSysPath = path.resolve(process.cwd(), 'sistemaativo-database.sqlite');
        if (!fs.existsSync(activeSysPath)) return { erro: 'Nenhum sistema ativo encontrado no servidor.' };
        
        const sysDb = new Database(activeSysPath, { readonly: true });
        const sysRow = sysDb.prepare('SELECT conteudo_json FROM sistema_ativo LIMIT 1').get();
        sysDb.close();

        if (!sysRow || !sysRow.conteudo_json) return { erro: 'Sistema ativo inválido ou corrompido.' };
        const sistemaObj = JSON.parse(sysRow.conteudo_json);
        const nomeSistema = sistemaObj.nomeSistema || sistemaObj.nome || sistemaObj.sistema || 'Sistema Padrão';

        // 2. Busca o avatar ativo do usuário (se houver tabela de avatares)
        let avatarNome = 'Padrão';
        const avatarDbPath = path.resolve(process.cwd(), 'database-avatares.sqlite');
        if (fs.existsSync(avatarDbPath)) {
            const avDb = new Database(avatarDbPath, { readonly: true });
            // Tenta buscar o avatar ativo ou o primeiro do usuário
            const avRow = avDb.prepare('SELECT nome FROM avatares WHERE userId = ? LIMIT 1').get(userId);
            avDb.close();
            if (avRow) avatarNome = avRow.nome;
        }

        // 3. Busca a ficha correspondente na database de fichas
        const fichaDbPath = path.resolve(process.cwd(), 'database-fichas.sqlite');
        if (!fs.existsSync(fichaDbPath)) return { erro: 'Nenhuma base de fichas encontrada.' };

        const fichaDb = new Database(fichaDbPath, { readonly: true });
        const fichaRow = fichaDb.prepare(`
            SELECT * FROM fichas 
            WHERE userId = ? 
              AND (LOWER(TRIM(sistemaNome)) = LOWER(TRIM(?)) OR sistemaNome IS NULL)
            LIMIT 1
        `).get(userId, nomeSistema);
        fichaDb.close();

        if (!fichaRow) {
            return { erro: `Você não possui nenhuma ficha criada para o sistema **${nomeSistema}** com o avatar **${avatarNome}**!` };
        }

        let dadosFicha = {};
        try { dadosFicha = JSON.parse(fichaRow.dadosJson || '{}'); } catch (e) {}

        return {
            nomeSistema,
            avatarNome: fichaRow.avatarNome || avatarNome,
            fichaId: String(fichaRow.id),
            sistemaConfig: sistemaObj,
            dadosFicha
        };
    } catch (err) {
        console.error('Erro ao checar contexto ativo:', err);
        return { erro: 'Erro interno ao validar o sistema e ficha ativos.' };
    }
}

function obterSistemaAtivo() {
    try {
        const activeSysPath = path.resolve(process.cwd(), 'sistemaativo-database.sqlite');
        if (!fs.existsSync(activeSysPath)) return null;
        const sysDb = new Database(activeSysPath, { readonly: true });
        const sysRow = sysDb.prepare('SELECT conteudo_json FROM sistema_ativo LIMIT 1').get();
        sysDb.close();
        if (!sysRow || !sysRow.conteudo_json) return null;
        const sistemaObj = JSON.parse(sysRow.conteudo_json);
        return sistemaObj.nomeSistema || sistemaObj.nome || sistemaObj.sistema || 'Sistema Padrão';
    } catch (e) {
        return null;
    }
}

module.exports = { obterContextoAtivo, obterSistemaAtivo };