const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

async function abrirModalNomeLista(interaction, sistema) {
    const modal = new ModalBuilder()
        .setCustomId(`salv_modal_nome_${sistema}`)
        .setTitle('Criar Nova Lista de Subtipos');

    const input = new TextInputBuilder()
        .setCustomId('nome_lista_input')
        .setLabel('Qual o nome para dar pra lista?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: MeusSubtiposOficiais')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
}

module.exports = { abrirModalNomeLista };