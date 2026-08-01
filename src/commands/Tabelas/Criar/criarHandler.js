const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const { getActiveSystem } = require('../utils/checkSystem');
const criarComum = require('./criarComum');
const criarArma = require('./criarArma');
const criarArmadura = require('./criarArmadura');

module.exports = async function(interaction) {
    const activeSystem = getActiveSystem(interaction.guild.id);

    if (!activeSystem) {
        const errEmbed = new EmbedBuilder()
            .setTitle('❌ Nenhum Sistema Ativo')
            .setDescription('Ative um sistema de RPG primeiro utilizando o comando `/sistemas ativar`.')
            .setColor(0xED4245);
        return interaction.reply({ embeds: [errEmbed], flags: [MessageFlags.Ephemeral] });
    }

    const embed = new EmbedBuilder()
        .setTitle('🛠️ Criação de Tabelas')
        .setDescription(`Sistema ativo detectado: **${activeSystem}**\n\nQue tipo de tabela deseja criar?`)
        .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_tipo_criar')
            .setPlaceholder('Selecione o tipo de tabela...')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Item Comum').setDescription('Criar itens genéricos e consumíveis').setValue('comum'),
                new StringSelectMenuOptionBuilder().setLabel('Arma').setDescription('Criar armas customizadas').setValue('arma'),
                new StringSelectMenuOptionBuilder().setLabel('Armadura').setDescription('Criar armaduras e proteções').setValue('armadura')
            ])
    );

    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 60000, max: 1 });

    collector.on('collect', async i => {
        if (i.values[0] === 'comum') return criarComum(i, activeSystem);
        if (i.values[0] === 'arma') return criarArma(i, activeSystem);
        if (i.values[0] === 'armadura') return criarArmadura(i, activeSystem);
    });
};