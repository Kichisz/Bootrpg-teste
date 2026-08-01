const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const sessionManager = require('./sessionManager');

async function iniciarPv(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('❤️ Sistema de Pontos de Vida (PV)')
        .setDescription('O seu sistema possui pontos de vida, vitalidade ou saúde física?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_tem_pv')
            .setPlaceholder('O sistema possui PV?')
            .addOptions([
                { label: 'Sim, possui PV / Vida', value: 'sim' },
                { label: 'Não utilizamos PV', value: 'nao' }
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

async function processarPvTexto(message, session, avancarProximoPasso) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    session.waitingForPvNome = false;
    session.data.pvNome = texto;

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`❤️ Cálculo de ${session.data.pvNome}`)
        .setDescription(`Como o valor inicial de **${session.data.pvNome}** é calculado?`);

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_pv_calc')
            .setPlaceholder('Escolha a forma de cálculo...')
            .addOptions([
                { label: 'Base fixa + Atributo (Ex: 10 + Vigor)', value: 'base_mais_atrib' },
                { label: 'Apenas valor fixo padrão', value: 'fixo' },
                { label: 'Multiplicador por Nível / Atributo', value: 'multiplicador' },
                { label: 'Rolagem de dado + Atributo', value: 'dado_mais_atrib' },
                { label: 'Rolagem de dado', value: 'dado' }
            ])
    );

    const msg = await message.channel.send({ embeds: [embed], components: [row] });
    sessionManager.salvarMensagemAtual(session, msg);
    return true;
}

module.exports = {
    iniciarPv,
    processarPvTexto
};