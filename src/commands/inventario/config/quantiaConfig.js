const { EmbedBuilder, MessageFlags } = require('discord.js');
const dbManager = require('../database/dbManager');

async function iniciarConfigQuantia(interaction, session) {
    session.waitingForQuantiaMax = true;
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔢 Limite de Quantidade de Itens')
        .setDescription('Quantos itens ao máximo a pessoa pode ter no inventário? (Ex: `20`). Envie apenas o número no chat:');

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed], components: [] });
    } else if (typeof interaction.update === 'function') {
        await interaction.update({ embeds: [embed], components: [] });
    } else {
        await interaction.reply({ embeds: [embed], components: [], flags: MessageFlags.Ephemeral });
    }
}

async function processarQuantiaTexto(message, session) {
    if (!session.waitingForQuantiaMax) return false;
    const quantiaMax = message.content.trim();
    const sistemaAtivo = dbManager.getSistemaAtivo();
    if (!sistemaAtivo) return false;

    let config = dbManager.carregarConfigSistema(sistemaAtivo.nomeSistema) || {};
    config.quantiaMax = quantiaMax;
    dbManager.salvarConfigSistema(sistemaAtivo.nomeSistema, config);

    session.waitingForQuantiaMax = false;
    try { await message.delete(); } catch (e) {}

    const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Limite de Quantidade Configurado')
        .setDescription(`O inventário do sistema **${sistemaAtivo.nomeSistema}** agora possui limite máximo de **${quantiaMax} itens**.`);

    await message.channel.send({ embeds: [embed] });
    return true;
}

module.exports = { iniciarConfigQuantia, processarQuantiaTexto };