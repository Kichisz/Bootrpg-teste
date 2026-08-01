const path = require('path');
const db = require('../../../database'); // Ajustado para apontar para o banco de dados principal do bot

function getActiveSystem(guildId) {
    try {
        // Busca o ID do sistema ativo na tabela guild_active_system[cite: 3, 5]
        const activeRow = db.prepare('SELECT systemId FROM guild_active_system WHERE guildId = ?').get(guildId);
        if (!activeRow) return null;

        // Busca os dados do sistema correspondente na tabela rpg_systems[cite: 3, 5]
        const sys = db.prepare('SELECT * FROM rpg_systems WHERE id = ?').get(activeRow.systemId);
        if (!sys) return null;

        // Retorna o nome oficial do sistema ativo[cite: 3, 5]
        return sys.nome || sys.nomeSistema || 'Sistema RPG';
    } catch (err) {
        console.error('Erro ao verificar o sistema ativo:', err);
        return null;
    }
}

module.exports = { getActiveSystem };