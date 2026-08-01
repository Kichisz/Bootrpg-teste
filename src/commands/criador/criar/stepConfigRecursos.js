const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const sessionManager = require('./sessionManager');

async function iniciarRecursosExtras(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🌀 Recursos Adicionais')
        .setDescription('Seu sistema possui outros recursos?\n\n💡 *Exemplo: sanidade, humanidade, sangue, corrupção, energia etc.*');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_tem_recursos_extras')
            .setPlaceholder('O sistema possui outros recursos?')
            .addOptions([
                { label: 'Sim, possui outros recursos', value: 'sim' },
                { label: 'Não possui outros recursos', value: 'nao' }
            ])
    );

    if (typeof channelOrInteraction.update === 'function' && !channelOrInteraction.deferred && !channelOrInteraction.replied) {
        await channelOrInteraction.update({ embeds: [embed], components: [row] });
    } else if (typeof channelOrInteraction.editReply === 'function') {
        await channelOrInteraction.editReply({ embeds: [embed], components: [row] });
    } else {
        const channel = channelOrInteraction.channel || channelOrInteraction;
        const msg = await channel.send({ embeds: [embed], components: [row] });
        sessionManager.salvarMensagemAtual(session, msg);
    }
    return true;
}

async function processarRecursosExtrasTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    session.waitingForRecursosExtrasNomes = false;
    session.data.recursosExtrasLista = texto.split(',').map(s => {
        const limpo = s.trim();
        return limpo.charAt(0).toUpperCase() + limpo.slice(1);
    }).filter(Boolean);

    session.recursosExtrasIndex = 0;
    session.data.recursosExtrasConfig = [];

    return true;
}

module.exports = {
    iniciarRecursosExtras,
    processarRecursosExtrasTexto
};