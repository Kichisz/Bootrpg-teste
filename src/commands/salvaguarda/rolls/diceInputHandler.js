const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function solicitarDado(interaction, subtipoChave, componentesRestantes) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎲 Rolagem de Dados')
        .setDescription(`Para o subtipo **${subtipoChave}**, informe quais dados rodar para esse saving throw (ex: \`1d6\`, \`d10\`). Responda enviando no chat.`);

    await interaction.update({ embeds: [embed], components: [] });
    // O gerenciador de mensagens subsequentes capturará a resposta
}

module.exports = { solicitarDado };