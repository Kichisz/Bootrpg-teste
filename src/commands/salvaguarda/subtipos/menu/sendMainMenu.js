const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getDb } = require('../database/dbConnection');

async function enviarMenuPrincipal(interaction, nomeLista, sistema) {
    const db = getDb();
    const itens = db.prepare('SELECT * FROM subtipos_salvaguarda WHERE sistema = ? AND nomeLista = ? AND userId = ?').all(sistema, nomeLista, interaction.user.id);
    db.close();

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ Salvaguarda: ${nomeLista}`)
        .setDescription(
            `Sistema: **${sistema}**\n` +
            `Total de subtipos cadastrados: **${itens.length}**\n\n` +
            'Escolha uma das opções abaixo no menu para gerenciar esta lista:'
        )
        .setColor(0x5865F2);

    if (itens.length > 0) {
        const camposDesc = itens.slice(0, 10).map(i => `• **${i.tipo}**: ${i.subtipo}`).join('\n');
        embed.addFields({ name: '📋 Amostra de Subtipos', value: camposDesc || 'Nenhum' });
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`salv_main_action_${nomeLista}_${sistema}`)
        .setPlaceholder('Selecione uma ação...')
        .addOptions(
            { label: 'Adicionar Subtipo', value: 'adicionar', description: 'Adiciona novos subtipos a esta lista', emoji: '➕' },
            { label: 'Editar Subtipo', value: 'editar', description: 'Edita o nome ou descrição de um subtipo', emoji: '✏️' },
            { label: 'Remover Subtipo', value: 'remover', description: 'Remove subtipos desta lista', emoji: '🗑️' },
            { label: 'Clonar Lista', value: 'clonar', description: 'Clona esta lista para outro sistema', emoji: '📋' }
        );

    const row = new ActionRowBuilder().addComponents(select);
    const payload = { embeds: [embed], components: [row] };

    if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload).catch(() => {});
    } else {
        return interaction.update(payload).catch(() => {});
    }
}

// 🛡️ EXPORTAÇÃO DUPLA: Funciona tanto com quanto sem chaves ({ enviarMenuPrincipal }) em qualquer arquivo
module.exports = enviarMenuPrincipal;
module.exports.enviarMenuPrincipal = enviarMenuPrincipal;