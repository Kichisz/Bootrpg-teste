const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function iniciarXp(session) {
    // Forçamos a etapa a perguntar sempre, garantindo que nunca seja pulada
    session.step = 'AGUARDANDO_XP_PERGUNTA';
    const tipoNome = session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC';

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('criarficha_xp_sim').setLabel('Sim').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('criarficha_xp_nao').setLabel('Não').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador de Fichas — Sistema de XP')
        .setDescription(`Este ${tipoNome} irá **dar XP** ao ser derrotado ou interagir?`);

    // Verifica se a interação atual ainda é válida para edição, senão usa o canal/última mensagem da session
    if (session.interaction && session.interaction.editReply) {
        await session.interaction.editReply({ embeds: [embed], components: [row] });
    }
}

async function lidarComXpBotoes(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('criarficha_xp_')) return false;
    await interaction.deferUpdate();

    const session = require('./sessionCriarficha').getSession(interaction.user.id);
    session.interaction = interaction;
    const escolha = interaction.customId.replace('criarficha_xp_', '');

    if (escolha === 'nao') {
        session.data.xpDesejado = false;
        session.data.xpQuantidade = 0;
        const { iniciarLootSelect } = require('./etapaLootSelect');
        await iniciarLootSelect(session);
        return true;
    }

    session.data.xpDesejado = true;
    session.step = 'AGUARDANDO_XP_QTD';

    const tipoNome = session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC';
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador de Fichas — Quantidade de XP')
        .setDescription(`Quanto de **XP** esse ${tipoNome} irá dar ao ser derrotado?\n\n*Envie apenas o número na sua próxima mensagem no chat.*`);

    await interaction.editReply({ embeds: [embed], components: [] });
    return true;
}

async function processarXpTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}
    const val = Number(texto);

    if (isNaN(val)) {
        // Opcional: Avisar que precisa ser número, mas por segurança definimos 0 ou ignoramos
        return;
    }

    session.data.xpQuantidade = val;
    const { iniciarLootSelect } = require('./etapaLootSelect');
    await iniciarLootSelect(session);
}

module.exports = {
    iniciarXp,
    lidarComXpBotoes,
    processarXpTexto
};