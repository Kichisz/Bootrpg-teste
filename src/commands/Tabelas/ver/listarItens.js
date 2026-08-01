const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { itensDb } = require('../database/dbManager');

module.exports = async function(interaction, activeSystem) {
    const items = itensDb.prepare('SELECT * FROM itens WHERE userId = ? AND systemName = ?').all(interaction.user.id, activeSystem);

    if (items.length === 0) {
        return interaction.update({ embeds: [new EmbedBuilder().setTitle('📦 Itens Comuns').setDescription('Você não criou nenhum item comum para este sistema ativo.').setColor(0x2F3136)], components: [] });
    }

    let page = 0;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(items.length / itemsPerPage);

    const generateEmbed = (p) => {
        const slice = items.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
        const desc = slice.map(item => `• **${item.nome}** — *${item.peso}kg*`).join('\n');

        return new EmbedBuilder()
            .setTitle(`📦 Seus Itens Comuns (${activeSystem})`)
            .setDescription(desc)
            .setColor(0x2F3136) // Cor cinza solicitada
            .setFooter({ text: `Página ${p + 1} de ${totalPages}` });
    };

    const getButtons = (p) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_page').setLabel('◀ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId('next_page').setLabel('Próxima ▶').setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1)
    );

    await interaction.update({ embeds: [generateEmbed(page)], components: totalPages > 1 ? [getButtons(page)] : [] });

    if (totalPages > 1) {
        const reply = await interaction.fetchReply();
        const collector = reply.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'Você não pode usar estes botões.', ephemeral: true });
            if (i.customId === 'prev_page' && page > 0) page--;
            if (i.customId === 'next_page' && page < totalPages - 1) page++;
            await i.update({ embeds: [generateEmbed(page)], components: [getButtons(page)] });
        });
    }
};