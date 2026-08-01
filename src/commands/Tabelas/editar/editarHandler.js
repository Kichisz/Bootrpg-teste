const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const { getActiveSystem } = require('../utils/checkSystem');
const editarSelecao = require('./editarSelecao');

module.exports = async function(interaction) {
    const activeSystem = getActiveSystem(interaction.guild.id);
    if (!activeSystem) {
        return interaction.reply({ content: '❌ Nenhum sistema ativo.', flags: [MessageFlags.Ephemeral] });
    }

    const embed = new EmbedBuilder()
        .setTitle('✏️ Edição de Tabelas')
        .setDescription(`Sistema ativo: **${activeSystem}**\nQual tabela deseja gerenciar/editar?`)
        .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_tabela_editar')
            .setPlaceholder('Escolha a tabela...')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Itens Comuns').setValue('edit_comuns'),
                new StringSelectMenuOptionBuilder().setLabel('Armas').setValue('edit_armas'),
                new StringSelectMenuOptionBuilder().setLabel('Armaduras').setValue('edit_armaduras')
            ])
    );

    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 60000, max: 1 });

    collector.on('collect', async i => {
        await editarSelecao(i, activeSystem, i.values[0]);
    });
};