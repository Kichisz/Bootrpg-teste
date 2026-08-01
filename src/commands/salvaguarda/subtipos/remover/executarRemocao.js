const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDb } = require('../database/dbConnection');

function confirmarRemocao(interaction, idsSelecionados, nomeLista, sistema) {
    const db = getDb();
    const placeholders = idsSelecionados.map(() => '?').join(',');
    const itens = db.prepare(`SELECT tipo, subtipo FROM subtipos_salvaguarda WHERE id IN (${placeholders})`).all(idsSelecionados);
    db.close();

    const nomesFormatados = itens.map(i => `• ${i.tipo}:${i.subtipo}`).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('⚠️ Confirmação de Exclusão')
        .setDescription(`Deseja mesmo excluir os seguintes subtipos?\n\n${nomesFormatados}`)
        .setColor(0xED4245);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`salv_del_sim_${idsSelecionados.join(',')}_${nomeLista}_${sistema}`)
            .setLabel('Sim, excluir')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`salv_del_nao_${nomeLista}_${sistema}`)
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({ embeds: [embed], components: [row] });
}

module.exports = { confirmarRemocao };