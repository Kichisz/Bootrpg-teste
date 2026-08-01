const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

async function perguntarTipoCalculoTotal(interaction, subtipoChave, configTemp) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🧮 Tipo de Desafio / Cálculo Final')
        .setDescription(
            `Subtipo: \`${subtipoChave}\`\n\n` +
            'O número total vai ser um **valor fixo que o inimigo deve ultrapassar** ou deve ser **adicionado um dado para desafio** (ex: Atributo + Perícia = 5, e roda um d10 -> 5d10)?'
        );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`salv_calc_tipo_${subtipoChave}`)
        .setPlaceholder('Escolha o tipo de cálculo...')
        .addOptions([
            { label: 'Valor fixo que o inimigo deve ultrapassar', value: 'valor_fixo_inimigo', description: 'Ex: Valor total estático (ex: 5)' },
            { label: 'Gerar dado com o valor total (Ex: 5d10)', value: 'dado_desafio', description: 'Ex: Atributo + Perícia viram a quantidade ou max do dado' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.update({ embeds: [embed], components: [row] });
}

module.exports = { perguntarTipoCalculoTotal };