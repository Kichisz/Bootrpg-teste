const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getDb } = require('../database/dbConnection');

function abrirModalEdicaoCampo(interaction, subId, campo, nomeLista, sistema) {
    const db = getDb();
    const item = db.prepare('SELECT * FROM subtipos_salvaguarda WHERE id = ?').get(subId);
    db.close();

    const modal = new ModalBuilder()
        .setCustomId(`salv_modal_salvar_edicao_${subId}_${campo}_${nomeLista}_${sistema}`)
        .setTitle(`Editar ${campo === 'editar_nome' ? 'Nome' : 'Descrição'}`);

    const input = new TextInputBuilder()
        .setCustomId('valor_novo_input')
        .setLabel(campo === 'editar_nome' ? 'Novo Tipo:Subtipo' : 'Nova Descrição')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(campo === 'editar_nome' ? `${item.tipo}:${item.subtipo}` : item.descricao)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
}

module.exports = { abrirModalEdicaoCampo };