const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

async function abrirModalAdicionar(interaction, nomeLista, sistema) {
    try {
        const embed = new EmbedBuilder()
            .setTitle(`📝 Adicionar Subtipos: ${nomeLista}`)
            .setDescription('Clique no botão abaixo para abrir a janela onde você digitará os subtipos.')
            .setColor(0x5865F2);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_abrir_modal_sub_${nomeLista}_${sistema}`)
                .setLabel('Digitar Subtipos')
                .setStyle(ButtonStyle.Primary)
        );

        // Como viemos de um modal submit, usamos reply/followUp em vez de showModal
        if (interaction.deferred || interaction.replied) {
            return await interaction.followUp({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
        } else {
            return await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
        }
    } catch (error) {
        console.error('Erro ao abrir o passo de adição:', error);
    }
}

module.exports = { abrirModalAdicionar };