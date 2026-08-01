const { EmbedBuilder } = require('discord.js');

async function enviarOuEditar(target, payload, session) {
    if (session.botMessage && typeof session.botMessage.edit === 'function') {
        try {
            session.botMessage = await session.botMessage.edit(payload);
            return session.botMessage;
        } catch (e) {}
    }
    const channel = target.channel || target;
    if (channel && typeof channel.send === 'function') {
        session.botMessage = await channel.send(payload).catch(() => {});
        return session.botMessage;
    }
}

async function iniciar(message, session) {
    const config = session.sistemaConfig;
    if (!config.temPm) {
        session.etapaAtual = 'recursos';
        const fichaRecursos = require('./fichaRecursos');
        return fichaRecursos.iniciar(message, session);
    }

    const pmNome = config.pmNome || 'PM';
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`✨ Passo 8/12 — Pontos de Mana / Energia (${pmNome})`)
        .setDescription(
            `O **${pmNome}** é utilizado para canalizar magias, habilidades especiais ou poderes.\n\n` +
            `Informe o valor inicial para o seu **${pmNome}**:`
        );

    const payload = { embeds: [embed] };
    return await enviarOuEditar(message, payload, session);
}

async function processar(message, session) {
    try { await message.delete(); } catch (e) {}
    session.data.pmValor = message.content.trim();

    session.etapaAtual = 'recursos';
    const fichaRecursos = require('./fichaRecursos');
    return fichaRecursos.iniciar(message, session);
}

module.exports = { iniciar, processar };