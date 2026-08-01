const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getDb } = require('../database/dbConnection');

function perguntarCampoParaEditar(interaction, subId, nomeLista, sistema) {
    const db = getDb();
    const item = db.prepare('SELECT * FROM subtipos_salvaguarda WHERE id = ?').get(subId);
    db.close();

    if (!item) {
        return interaction.update({ content: '❌ Subtipo não encontrado.', embeds: [], components: [] });
    }

    const embed = new EmbedBuilder()
        .setTitle(`✏️ Editando: ${item.tipo}:${item.subtipo}`)
        .setDescription(`O que você deseja editar neste subtipo?\n\n**Descrição atual:**\n${item.descricao}`)
        .setColor(0xFEE75C);

    const select = new StringSelectMenuBuilder()
        .setCustomId(`salv_edit_campo_${subId}_${nomeLista}_${sistema}`)
        .setPlaceholder('Escolha o que deseja alterar...')
        .addOptions([
            { label: 'Editar Nome (Tipo:Subtipo)', value: 'editar_nome', description: 'Altera o nome do tipo ou subtipo' },
            { label: 'Editar Descrição', value: 'editar_descricao', description: 'Altera o texto descritivo e regras' }
        ]);

    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

module.exports = { perguntarCampoParaEditar };