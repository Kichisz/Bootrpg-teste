const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getDb } = require('../database/dbConnection');

function listarSistemasParaClonar(interaction, sistemaAtual) {
    const db = getDb();
    const rows = db.prepare(`
        SELECT DISTINCT sistema, nomeLista FROM subtipos_salvaguarda 
        WHERE userId = ? AND sistema != ?
    `).all(interaction.user.id, sistemaAtual);
    db.close();

    if (rows.length === 0) {
        return interaction.update({
            content: '❌ Você não possui listas de subtipos em outros sistemas para clonar.',
            embeds: [],
            components: []
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🧬 Clonar Lista de Subtipos')
        .setDescription('De qual sistema e lista deseja clonar os subtipos para este sistema?')
        .setColor(0x57F287);

    const select = new StringSelectMenuBuilder()
        .setCustomId(`salv_clone_select_${sistemaAtual}`)
        .setPlaceholder('Selecione a origem da clonagem...');

    rows.forEach(r => {
        select.addOptions({
            label: `Sistema: ${r.sistema} (Lista: ${r.nomeLista})`.substring(0, 100),
            value: `${r.sistema}__${r.nomeLista}`,
            description: `Clonar do sistema ${r.sistema}`
        });
    });

    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

module.exports = { listarSistemasParaClonar };