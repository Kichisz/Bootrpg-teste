const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const { getActiveSystem } = require('../utils/checkSystem');
const listarItens = require('./listarItens');
const listarArmas = require('./listarArmas');
const listarArmaduras = require('./listarArmaduras');

module.exports = async function(interaction) {
    const activeSystem = getActiveSystem(interaction.guild.id);
    if (!activeSystem) {
        return interaction.reply({ content: '❌ Nenhum sistema ativo. Ative com `/sistemas ativar`.', flags: [MessageFlags.Ephemeral] });
    }

    const embed = new EmbedBuilder()
        .setTitle('📋 Visualização de Tabelas')
        .setDescription(`Sistema ativo: **${activeSystem}**\nQual tabela quer ver os itens criados para esse sistema?`)
        .setColor(0x2F3136); // Quadrado cinza bonitão

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_tabela_ver')
            .setPlaceholder('Escolha a tabela...')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Itens Comuns').setValue('ver_comuns'),
                new StringSelectMenuOptionBuilder().setLabel('Armas').setValue('ver_armas'),
                new StringSelectMenuOptionBuilder().setLabel('Armaduras').setValue('ver_armaduras')
            ])
    );

    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 60000, max: 1 });

    collector.on('collect', async i => {
        if (i.values[0] === 'ver_comuns') return listarItens(i, activeSystem);
        if (i.values[0] === 'ver_armas') return listarArmas(i, activeSystem);
        if (i.values[0] === 'ver_armaduras') return listarArmaduras(i, activeSystem);
    });
};