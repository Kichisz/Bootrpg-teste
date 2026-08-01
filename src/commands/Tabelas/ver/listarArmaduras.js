const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { armadurasDb } = require('../database/dbManager');

module.exports = async function(interaction, activeSystem) {
    const armaduras = armadurasDb.prepare('SELECT * FROM armaduras WHERE userId = ? AND systemName = ?').all(interaction.user.id, activeSystem);

    if (armaduras.length === 0) {
        return interaction.update({ embeds: [new EmbedBuilder().setTitle('🛡️ Armaduras').setDescription('Você não criou nenhuma armadura para este sistema ativo.').setColor(0x2F3136)], components: [] });
    }

    let page = 0;
    const itemsPerPage = 3;
    const totalPages = Math.ceil(armaduras.length / itemsPerPage);

    const generateEmbed = (p) => {
        const slice = armaduras.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
        const desc = slice.map(a => `• **${a.nome}**\n  - Bônus CA: ${a.bonusCa} | Pen. Des: ${a.penalidadeDestreza}\n  - Peso: ${a.peso}kg\n  - *${a.descricao}*`).join('\n\n');

        return new EmbedBuilder()
            .setTitle(`🛡️ Suas Armaduras (${activeSystem})`)
            .setDescription(desc)
            .setColor(0x2F3136)
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
            if (i.user.id !== interaction.user.id) return;
            if (i.customId === 'prev_page' && page > 0) page--;
            if (i.customId === 'next_page' && page < totalPages - 1) page++;
            await i.update({ embeds: [generateEmbed(page)], components: [getButtons(page)] });
        });
    }
};