const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const sessionExcluir = new Map();

// Função auxiliar robusta para buscar todos os IDs possíveis de uma ficha (mesma usada no darItem)
function obterIdsPossiveisFicha(fichaId) {
    let ids = [String(fichaId)];
    try {
        const rootDir = path.resolve('.');
        const arquivos = fs.readdirSync(rootDir);
        let dbFichas;
        for (const file of arquivos) {
            if (file.endsWith('.sqlite') && !file.includes('database')) {
                try {
                    const test = new Database(path.join(rootDir, file), { readonly: true });
                    if (test.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fichas'").get()) {
                        dbFichas = test;
                        break;
                    }
                    test.close();
                } catch(e){}
            }
        }
        if (!dbFichas) dbFichas = new Database(path.resolve('fichas.sqlite'), { readonly: true });

        const ficha = dbFichas.prepare('SELECT id, rowid, userId FROM fichas WHERE id = ? OR rowid = ? OR userId = ?').get(fichaId, fichaId, fichaId);
        dbFichas.close();
        if (ficha) {
            if (ficha.id) ids.push(String(ficha.id));
            if (ficha.rowid) ids.push(String(ficha.rowid));
            if (ficha.userId) ids.push(String(ficha.userId));
        }
    } catch (e) {}
    return [...new Set(ids.filter(Boolean))];
}

module.exports = {
    async iniciar(interaction, targetUserId, fichaId) {
        const invDb = new Database(path.resolve('inventarioplayers-database.sqlite'));
        invDb.prepare(`
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
            )
        `).run();

        const possiveisIds = obterIdsPossiveisFicha(fichaId);
        const placeholders = possiveisIds.map(() => '?').join(',');
        const itens = invDb.prepare(`SELECT * FROM inventario_itens WHERE fichaId IN (${placeholders})`).all(...possiveisIds);
        invDb.close();

        if (!itens || itens.length === 0) {
            return interaction.update({ content: '⚠️ Este personagem não possui nenhum item no inventário.', components: [], embeds: [] });
        }

        const options = itens.slice(0, 25).map(i => ({
            label: String(i.nome).substring(0, 100),
            description: `Tipo: ${i.tipo} | Qnt: ${i.quantia || 1} | Peso: ${i.peso || 0}kg`,
            value: String(i.id)
        }));

        sessionExcluir.set(interaction.user.id, { fichaId, itensCache: itens });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`excluir_selecionar_${targetUserId}`)
                .setPlaceholder('Selecione os itens para excluir...')
                .setMinValues(1)
                .setMaxValues(Math.min(options.length, 25))
                .addOptions(options)
        );

        return interaction.update({ content: '🗑️ Selecione abaixo os itens que deseja excluir do inventário:', components: [row], embeds: [] });
    },

    async handleInteractions(interaction) {
        const customId = interaction.customId;
        if (!customId) return false;

        if (customId.startsWith('excluir_selecionar_')) {
            const session = sessionExcluir.get(interaction.user.id);
            if (!session) return interaction.reply({ content: '⚠️ Sessão expirada.', flags: [MessageFlags.Ephemeral] });

            session.idsParaExcluir = interaction.values;
            const nomes = session.itensCache
                .filter(i => session.idsParaExcluir.includes(String(i.id)))
                .map(i => i.nome)
                .join(', ');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('excluir_sim').setLabel('Sim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('excluir_nao').setLabel('Não').setStyle(ButtonStyle.Danger)
            );

            return interaction.update({ content: `❓ Tem certeza que deseja deletar o(s) item(ns): **${nomes}**?`, components: [row] });
        }

        if (customId === 'excluir_sim' || customId === 'excluir_nao') {
            const session = sessionExcluir.get(interaction.user.id);
            if (!session) return interaction.reply({ content: '⚠️ Sessão expirada.', flags: [MessageFlags.Ephemeral] });

            if (customId === 'excluir_nao') {
                sessionExcluir.delete(interaction.user.id);
                return interaction.update({ content: '❌ Operação cancelada.', components: [] });
            }

            const invDb = new Database(path.resolve('inventarioplayers-database.sqlite'));
            const placeholders = session.idsParaExcluir.map(() => '?').join(',');
            invDb.prepare(`DELETE FROM inventario_itens WHERE id IN (${placeholders})`).run(...session.idsParaExcluir);
            invDb.close();

            sessionExcluir.delete(interaction.user.id);
            return interaction.update({ content: '✅ Item(ns) excluído(s) com sucesso do inventário!', components: [] });
        }
        return false;
    },

    async handleMessages(message) { return false; }
};