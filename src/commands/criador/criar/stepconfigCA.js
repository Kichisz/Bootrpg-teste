const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const sessionManager = require('./sessionManager');

async function iniciarCa(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Classe de Armadura / Defesa (CA)')
        .setDescription('O sistema possui um atributo ou recurso fixo para defesa passiva contra ataques?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_tem_ca')
            .setPlaceholder('O sistema possui CA?')
            .addOptions([
                { label: 'Sim, possui CA / Defesa', value: 'sim' },
                { label: 'Não utilizamos CA', value: 'nao' }
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

async function processarCaTexto(message, session, avancarProximoPasso) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    session.waitingForCaNome = false;
    session.data.caNome = texto;

    return await avancarProximoPasso(message, session);
}

module.exports = {
    iniciarCa,
    processarCaTexto
};