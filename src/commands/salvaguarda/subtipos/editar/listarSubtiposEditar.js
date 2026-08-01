const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getDb } = require('../database/dbConnection');

function listarParaEditar(interaction, nomeLista, sistema) {
    const db = getDb();
    const rows = db.prepare(`
        SELECT id, tipo, subtipo FROM subtipos_salvaguarda 
        WHERE nomeLista = ? AND sistema = ? AND userId = ? 
        ORDER BY tipo ASC, subtipo ASC
    `).all(nomeLista, sistema, interaction.user.id);
    db.close();

    if (rows.length === 0) {
        return interaction.update({
            content: '❌ Não há subtipos cadastrados nesta lista para editar.',
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
        .setCustomId(`salv_edit_select_item_${nomeLista}_${sistema}`)
        .setPlaceholder('Selecione o subtipo que deseja editar...');

    for (const [tipo, listaSub] of Object.entries(agrupados)) {
        textoFormatado += `**${tipo}:**\n`;
        listaSub.forEach(item => {
            textoFormatado += ` • ${item.subtipo}\n`;
            select.addOptions({
                label: `${tipo}: ${item.subtipo}`.substring(0, 100),
                value: String(item.id),
                description: 'Editar este subtipo'
            });
        });
    }

    const embed = new EmbedBuilder()
        .setTitle(`✏️ Editar Subtipos - ${nomeLista}`)
        .setDescription(`Qual subtipo você deseja editar?\n\n${textoFormatado}`.substring(0, 4096))
        .setColor(0xFEE75C);

    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

module.exports = { listarParaEditar };