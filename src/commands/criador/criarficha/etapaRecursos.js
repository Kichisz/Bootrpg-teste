const { EmbedBuilder } = require('discord.js');

async function pedirRecursoExtra(session) {
    if (!session.extraResourcesQueue || session.extraResourcesQueue.length === 0) {
        const { iniciarXp } = require('./etapaXp');
        return await iniciarXp(session);
    }

    const atual = session.extraResourcesQueue.shift();
    session.currentResource = atual;
    session.step = 'AGUARDANDO_RECURSO_BASE';

    const tipoNome = session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC';
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🤖 Criador de Fichas — Recurso: ${atual}`)
        .setDescription(
            `Qual o **valor inicial** para este ${tipoNome} no recurso **${atual}**?\n` +
            `*(Ex: se for sanidade ou PV que diminui ao usar, coloque o valor máximo inicial; se for fome que sobe, coloque o valor inicial)*\n\n` +
            `*Envie o número na sua próxima mensagem.*`
        );

    await session.interaction.editReply({ embeds: [embed], components: [] });
}

async function processarRecursosTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}
    const val = Number(texto);

    if (isNaN(val)) return;

    const tipoNome = session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC';

    if (session.step === 'AGUARDANDO_RECURSO_BASE') {
        session.tempResourceBase = val;
        session.step = 'AGUARDANDO_RECURSO_LIMITE';

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🤖 Criador de Fichas — Limite de ${session.currentResource}`)
            .setDescription(`Qual o **valor máximo (ou mínimo)** que o ${tipoNome} pode ter em **${session.currentResource}**?\n\n*Envie o número na sua próxima mensagem.*`);

        await session.interaction.editReply({ embeds: [embed], components: [] });
        return;
    }

    if (session.step === 'AGUARDANDO_RECURSO_LIMITE') {
        session.data.recursos[session.currentResource] = {
            base: session.tempResourceBase,
            limite: val
        };

        await pedirRecursoExtra(session);
        return;
    }
}

module.exports = {
    pedirRecursoExtra,
    processarRecursosTexto
};