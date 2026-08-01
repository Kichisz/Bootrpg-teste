const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const sessionManager = require('./sessionManager');

async function iniciarPm(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('✨ Sistema de Mana / Energia (PM)')
        .setDescription('O seu sistema possui pontos de magia, energia, foco ou estamina?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_tem_pm')
            .setPlaceholder('O sistema possui PM?')
            .addOptions([
                { label: 'Sim, possui PM / Mana', value: 'sim' },
                { label: 'Não utilizamos PM', value: 'nao' }
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

async function processarPmTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    session.waitingForPmNome = false;
    session.data.pmNome = texto;

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`✨ Cálculo de ${session.data.pmNome}`)
        .setDescription(`Como o valor inicial de **${session.data.pmNome}** é calculado?`);

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_pm_calc')
            .setPlaceholder('Escolha a forma de cálculo...')
            .addOptions([
                { label: 'Base fixa + Atributo (Ex: 5 + Inteligência)', value: 'base_mais_atrib' },
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
    iniciarPm,
    processarPmTexto
};