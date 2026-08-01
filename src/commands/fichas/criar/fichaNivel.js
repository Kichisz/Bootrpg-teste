const { EmbedBuilder } = require('discord.js');

async function exibir(message, session) {
    const config = session.sistemaConfig;
    const tipoXp = config.tipoXpOpcao || 'nao';

    if (tipoXp === 'nao' || tipoXp === 'so_xp') {
        session.data.nivelPersonagem = 1;
        session.etapaAtual = 'atributos';
        const fichaAtributos = require('./fichaAtributos');
        return fichaAtributos.iniciar(message, session);
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📈 Passo 4/12 — Nível Inicial')
        .setDescription(
            `O sistema ativo (**${session.sistemaNome}**) utiliza progressão por níveis.\n\n` +
            'Por favor, informe com qual **nível numérico** seu personagem está começando (Ex: `1`, `3`, `5`):'
        );

    if (session.botMessage && typeof session.botMessage.edit === 'function') {
        try {
            session.botMessage = await session.botMessage.edit({ embeds: [embed], components: [] });
            return session.botMessage;
        } catch (e) {}
    }

    session.botMessage = await message.channel.send({ embeds: [embed], components: [] });
    return session.botMessage;
}

async function processar(message, session) {
    const valor = parseInt(message.content.trim()) || 1;
    session.data.nivelPersonagem = valor;

    session.etapaAtual = 'atributos';
    const fichaAtributos = require('./fichaAtributos');
    return fichaAtributos.iniciar(message, session);
}

module.exports = { exibir, processar };