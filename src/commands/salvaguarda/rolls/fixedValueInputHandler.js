const { EmbedBuilder } = require('discord.js');

async function solicitarValorFixo(interaction, subtipoChave) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📌 Valor Fixo')
        .setDescription(`Para o subtipo **${subtipoChave}**, qual valor fixo usar naquele saving throw? (ex: \`14\`). Envie o número no chat.`);

    await interaction.update({ embeds: [embed], components: [] });
}

module.exports = { solicitarValorFixo };