const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { itensDb, armasDb, armadurasDb } = require('../database/dbManager');
const editarAcao = require('./editarAcao');

module.exports = async function(interaction, activeSystem, tableType) {
    let db, prefix;
    if (tableType === 'edit_comuns') { db = itensDb; prefix = 'Item'; }
    if (tableType === 'edit_armas') { db = armasDb; prefix = 'Arma'; }
    if (tableType === 'edit_armaduras') { db = armadurasDb; prefix = 'Armadura'; }

    const items = db.prepare('SELECT * FROM items WHERE userId = ? AND systemName = ?').all ? 
                  db.prepare('SELECT * FROM itens WHERE userId = ? AND systemName = ?').all(interaction.user.id, activeSystem) :
                  db.prepare('SELECT * FROM ' + (tableType === 'edit_armas' ? 'armas' : 'armaduras') + ' WHERE userId = ? AND systemName = ?').all(interaction.user.id, activeSystem);

    if (items.length === 0) {
        return interaction.update({ embeds: [new EmbedBuilder().setTitle('❌ Edição').setDescription(`Não há nenhum ${prefix.toLowerCase()} cadastrado por você neste sistema ativo.`).setColor(0xED4245)], components: [] });
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId('select_item_editar')
        .setPlaceholder(`Selecione o(a) ${prefix.toLowerCase()} para editar...`)
        .addOptions(items.slice(0, 25).map(item => new StringSelectMenuOptionBuilder().setLabel(item.nome).setValue(String(item.id))));

    const row = new ActionRowBuilder().addComponents(select);
    const embed = new EmbedBuilder().setTitle(`✏️ Editar ${prefix}`).setDescription('Selecione abaixo o item que deseja modificar ou excluir:').setColor(0x5865F2);

    await interaction.update({ embeds: [embed], components: [row] });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 60000, max: 1 });

    collector.on('collect', async i => {
        const selectedId = i.values[0];
        const itemObj = db.prepare('SELECT * FROM ' + (tableType === 'edit_comuns' ? 'itens' : tableType === 'edit_armas' ? 'armas' : 'armaduras') + ' WHERE id = ?').get(selectedId);
        await editarAcao(i, tableType, itemObj, db);
    });
};