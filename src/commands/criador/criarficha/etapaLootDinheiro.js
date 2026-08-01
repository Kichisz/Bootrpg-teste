const { EmbedBuilder } = require('discord.js');

async function pedirDinheiro(session) {
    session.step = 'AGUARDANDO_DINHEIRO_TEXTO';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador de Fichas — Loot: Dinheiro')
        .setDescription(
            `Quanto de dinheiro será dropado?\n` +
            `Use o formato: Sigla da moeda, porcentagem com \`:\`, valor mínimo com \`<\` e máximo com \`>\`.\n` +
            `Exemplo: \`TP:5 <1 >100, TA:1 <1 >10\`\n\n` +
            `*Envie na sua próxima mensagem.*`
        );

    await session.interaction.editReply({ embeds: [embed], components: [] });
}

async function processarDinheiroTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    session.data.dinheiroDrop = texto;
    const { processarProximoLootTipo } = require('./etapaLootSelect');
    await processarProximoLootTipo(session);
}

module.exports = {
    pedirDinheiro,
    processarDinheiroTexto
};