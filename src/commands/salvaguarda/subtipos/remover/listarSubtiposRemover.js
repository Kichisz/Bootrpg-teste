const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getDb } = require('../database/dbConnection');

function listarParaRemover(interaction, nomeLista, sistema) {
    const db = getDb();
    const rows = db.prepare(`
        SELECT id, tipo, subtipo FROM subtipos_salvaguarda 
        WHERE nomeLista = ? AND sistema = ? AND userId = ? 
        ORDER BY tipo ASC, subtipo ASC
    `).all(nomeLista, sistema, interaction.user.id);
    db.close();

    if (rows.length === 0) {
        return interaction.update({
            content: '❌ Não há subtipos cadastrados nesta lista para remover.',
            embeds: [],
            components: []
        });
    }

    const agrupados = {};
    rows.forEach(r => {
        agrupados[r.tipo] = agrupados[r.tipo] || [];
        agrupados[r.tipo].push(r);
    });

    let textoFormatado = '';
    const select = new StringSelectMenuBuilder()
        .setCustomId(`salv_remove_select_${nomeLista}_${sistema}`)
        .setMinValues(1)
        .setMaxValues(Math.min(rows.length, 25))
        .setPlaceholder('Selecione os subtipos para remover...');

    for (const [tipo, listaSub] of Object.entries(agrupados)) {
        textoFormatado += `**${tipo}:**\n`;
        listaSub.forEach(item => {
            textoFormatado += ` • ${item.subtipo}\n`;
            select.addOptions({
                label: `${tipo}: ${item.subtipo}`.substring(0, 100),
                value: String(item.id),
                description: 'Remover este subtipo'
            });
        });
    }

    const embed = new EmbedBuilder()
        .setTitle(`🗑️ Remover Subtipos - ${nomeLista}`)
        .setDescription(`Selecione abaixo os subtipos que deseja remover:\n\n${textoFormatado}`.substring(0, 4096))
        .setColor(0xED4245);

    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

module.exports = { listarParaRemover };