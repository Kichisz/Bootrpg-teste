const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../../database');

function safeTruncate(str, maxLength = 100) {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}

module.exports = async (interaction) => {
    const userId = interaction.user.id;
    let tuppers = [];

    try {
        tuppers = db.prepare('SELECT * FROM tuppers WHERE userId = ?').all(userId);
    } catch (e) {
        tuppers = [];
    }

    const initialEmbed = new EmbedBuilder()
        .setTitle('🗑️ Deletar Avatares')
        .setDescription('Selecione abaixo os avatares que deseja deletar (**você pode selecionar vários** para deletar em massa):')
        .setColor(0xED4245);

    if (!tuppers || tuppers.length === 0) {
        initialEmbed.setDescription('❌ Você não possui nenhum avatar cadastrado para deletar!');
        return interaction.reply({ embeds: [initialEmbed], flags: [MessageFlags.Ephemeral] });
    }

    // O limite do Discord para opções em um menu é 25
    const tuppersToDisplay = tuppers.slice(0, 25);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_tuppers_delete_bulk')
        .setPlaceholder('Selecione um ou mais avatares para deletar...')
        .setMinValues(1)
        .setMaxValues(tuppersToDisplay.length)
        .addOptions(
            tuppersToDisplay.map(t => {
                let displayName = safeTruncate(t.nome || 'Avatar sem nome', 100);
                let desc = safeTruncate(`Prefixo: ${t.prefixo || 'Nenhum'}`, 100);

                return new StringSelectMenuOptionBuilder()
                    .setLabel(displayName)
                    .setDescription(desc)
                    .setValue(String(t.id));
            })
        );

    const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
    const rowButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('confirm_bulk_delete')
            .setLabel('🗑️ Confirmar Exclusão dos Selecionados')
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
        embeds: [initialEmbed],
        components: [rowSelect, rowButton],
        flags: [MessageFlags.Ephemeral]
    });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 60000 });

    let selectedValues = [];

    collector.on('collect', async i => {
        if (i.user.id !== userId) {
            return i.reply({ content: '❌ Você não pode usar este menu.', flags: [MessageFlags.Ephemeral] });
        }

        if (i.isStringSelectMenu() && i.customId === 'select_tuppers_delete_bulk') {
            selectedValues = i.values;
            const updatedEmbed = new EmbedBuilder()
                .setTitle('🗑️ Deletar Avatares')
                .setDescription(`✅ **${selectedValues.length}** avatar(s) selecionado(s).\nClique no botão vermelho abaixo para confirmar a exclusão.`)
                .setColor(0xED4245);

            await i.update({ embeds: [updatedEmbed], components: [rowSelect, rowButton] }).catch(() => {});
        } else if (i.isButton() && i.customId === 'confirm_bulk_delete') {
            if (selectedValues.length === 0) {
                return i.reply({ content: '❌ Você não selecionou nenhum avatar no menu acima!', flags: [MessageFlags.Ephemeral] });
            }

            const placeholders = selectedValues.map(() => '?').join(',');
            db.prepare(`DELETE FROM tuppers WHERE id IN (${placeholders}) AND userId = ?`).run(...selectedValues, userId);
            
            for (const tupperId of selectedValues) {
                db.prepare('DELETE FROM active_tuppers WHERE tupperId = ?').run(tupperId);
            }

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Avatares Deletados com Sucesso!')
                .setDescription(`Foram removidos **${selectedValues.length}** avatar(s) da sua lista.`)
                .setColor(0x57F287);

            await i.update({ embeds: [successEmbed], components: [] });
            collector.stop();
        }
    });
};