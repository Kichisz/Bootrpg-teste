const { EmbedBuilder } = require('discord.js');

async function pedirDescricaoAi(session) {
    session.step = 'AGUARDANDO_DESCRICAO_AI';
    const tipoNome = session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador de Fichas — Descrição Detalhada')
        .setDescription(
            `Gere uma **descrição** de como você quer que seu ${tipoNome} seja. Seja o mais específico possível!\n\n` +
            `💡 *Exemplo:* "Um guerreiro esqueleto veterano com armadura enferrujada, especialista em combate corpo a corpo, implacável."\n\n` +
            `*Envie sua descrição na próxima mensagem para gerarmos a ficha via IA.*`
        );

    await session.interaction.editReply({ embeds: [embed], components: [] });
}

async function processarDescricaoAi(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    session.data.descricaoAi = texto;
    const { gerarFichaComAi } = require('./etapaGerarAi');
    await gerarFichaComAi(session);
}

module.exports = {
    pedirDescricaoAi,
    processarDescricaoAi
};