const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { validateWeight } = require('../utils/weightValidation');

module.exports = async function(interaction, tableType, item, db) {
    const tableName = tableType === 'edit_comuns' ? 'itens' : tableType === 'edit_armas' ? 'armas' : 'armaduras';

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Gerenciar: ${item.nome}`)
        .setDescription('O que deseja fazer com este item?')
        .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('action_edit').setLabel('Editar').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('action_delete').setLabel('Excluir').setStyle(ButtonStyle.Danger)
    );

    await interaction.update({ embeds: [embed], components: [row] });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 60000, max: 1 });

    collector.on('collect', async i => {
        if (i.customId === 'action_delete') {
            db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(item.id);
            return i.update({ embeds: [new EmbedBuilder().setTitle('🗑️ Excluído').setDescription(`O item **${item.nome}** foi excluído com sucesso.`).setColor(0x57F287)], components: [] });
        }

        // Menu de campos a editar
        let options = [new StringSelectMenuOptionBuilder().setLabel('Nome').setValue('edit_nome')];
        if (tableType === 'edit_comuns') {
            options.push(new StringSelectMenuOptionBuilder().setLabel('Peso').setValue('edit_peso'));
        } else if (tableType === 'edit_armas') {
            options.push(
                new StringSelectMenuOptionBuilder().setLabel('Dado de dano').setValue('edit_dado'),
                new StringSelectMenuOptionBuilder().setLabel('Bônus de dano').setValue('edit_bonus'),
                new StringSelectMenuOptionBuilder().setLabel('Descrição').setValue('edit_desc'),
                new StringSelectMenuOptionBuilder().setLabel('Peso').setValue('edit_peso')
            );
        } else if (tableType === 'edit_armaduras') {
            options.push(
                new StringSelectMenuOptionBuilder().setLabel('Bônus de CA').setValue('edit_ca'),
                new StringSelectMenuOptionBuilder().setLabel('Penalidade destreza').setValue('edit_pen'),
                new StringSelectMenuOptionBuilder().setLabel('Descrição').setValue('edit_desc'),
                new StringSelectMenuOptionBuilder().setLabel('Peso').setValue('edit_peso')
            );
        }

        const editMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('select_field_edit').setPlaceholder('O que deseja editar neste item?').addOptions(options)
        );

        await i.update({ embeds: [new EmbedBuilder().setTitle(`✏️ Editando: ${item.nome}`).setDescription('Escolha o campo que deseja alterar:').setColor(0x5865F2)], components: [editMenu] });

        const colField = reply.createMessageComponentCollector({ time: 60000, max: 1 });
        colField.on('collect', async iField => {
            const field = iField.values[0];

            if (field === 'edit_nome') {
                await iField.update({ content: 'Digite o **novo nome**:', embeds: [], components: [] });
                const colMsg = interaction.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, time: 60000, max: 1 });
                colMsg.on('collect', async m => {
                    await m.delete().catch(() => {});
                    db.prepare(`UPDATE ${tableName} SET nome = ? WHERE id = ?`).run(m.content.trim(), item.id);
                    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('✅ Atualizado!').setDescription(`Nome alterado para **${m.content.trim()}**`).setColor(0x57F287)] });
                });
            } else if (field === 'edit_peso') {
                await iField.update({ content: 'Digite o **novo peso** (mínimo 0 ou 0,1kg):', embeds: [], components: [] });
                const colMsg = interaction.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, time: 60000, max: 1 });
                colMsg.on('collect', async m => {
                    await m.delete().catch(() => {});
                    const validation = validateWeight(m.content);
                    if (!validation.valid) return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌ Erro').setDescription(validation.message).setColor(0xED4245)] });
                    db.prepare(`UPDATE ${tableName} SET peso = ? WHERE id = ?`).run(validation.value, item.id);
                    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('✅ Atualizado!').setDescription(`Peso alterado para **${validation.value}kg**`).setColor(0x57F287)] });
                });
            } else {
                // Outros campos genéricos (Dado, Bônus, Descrição, etc.)
                await iField.update({ content: 'Digite o novo valor para este campo:', embeds: [], components: [] });
                const colMsg = interaction.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, time: 60000, max: 1 });
                colMsg.on('collect', async m => {
                    await m.delete().catch(() => {});
                    let colName = field === 'edit_dado' ? 'dadoDano' : field === 'edit_bonus' ? 'bonusDano' : field === 'edit_desc' ? 'descricao' : field === 'edit_ca' ? 'bonusCa' : 'penalidadeDestreza';
                    db.prepare(`UPDATE ${tableName} SET ${colName} = ? WHERE id = ?`).run(m.content.trim(), item.id);
                    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('✅ Atualizado!').setDescription('Campo alterado com sucesso!').setColor(0x57F287)] });
                });
            }
        });
    });
};