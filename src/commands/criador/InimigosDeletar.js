const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../../database');

async function executarDeletarInimigo(interaction) {
    if (!interaction.guild) {
        return interaction.reply({ content: '❌ Este comando só pode ser usado em servidores.', flags: [MessageFlags.Ephemeral] });
    }

    let inimigos = [];
    try {
        db.prepare(`
            CREATE TABLE IF NOT EXISTS lista_ficha_inimigos (
                id TEXT PRIMARY KEY,
                userId TEXT,
                guildId TEXT,
                systemId TEXT,
                name TEXT,
                sheetData TEXT,
                createdAt TEXT
            )
        `).run();

        inimigos = db.prepare('SELECT * FROM lista_ficha_inimigos WHERE guildId = ?').all(interaction.guild.id);
    } catch (e) {
        console.error('Erro ao buscar inimigos:', e);
    }

    if (!inimigos || inimigos.length === 0) {
        return interaction.reply({
            content: `📂 Não há nenhum **Inimigo** cadastrado neste servidor para deletar.`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    const options = inimigos.map((inm) => ({
        label: (inm.name || 'Inimigo Sem Nome').substring(0, 100),
        description: inm.createdAt ? `Criado em: ${new Date(inm.createdAt).toLocaleDateString('pt-BR')}` : 'Criado recentemente',
        value: String(inm.id)
    })).slice(0, 25);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_inimigos_deletar')
        .setPlaceholder('Selecione uma ou mais fichas para deletar...')
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🗑️ Deletar Fichas de Inimigos')
        .setDescription('Quais fichas de inimigo deseja deletar? Selecione abaixo no menu (você pode marcar várias):');

    const replyMsg = await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral], fetchReply: true });

    const collector = replyMsg.createMessageComponentCollector({ time: 120000 });
    let selectedIds = [];

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: '❌ Você não pode interagir com este menu.', flags: [MessageFlags.Ephemeral] });
        }

        if (i.isStringSelectMenu() && i.customId === 'select_inimigos_deletar') {
            selectedIds = i.values;
            const selectedInimigos = inimigos.filter(inm => selectedIds.includes(inm.id));
            const nomesStr = selectedInimigos.map(inm => `**${inm.name || 'Sem Nome'}**`).join(', ');

            const confirmEmbed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setTitle('⚠️ Confirmação de Exclusão')
                .setDescription(`Tem certeza que deseja deletar os seguintes inimigos:\n${nomesStr}?`);

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('confirm_inimigo_sim').setLabel('Sim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('confirm_inimigo_nao').setLabel('Não').setStyle(ButtonStyle.Danger)
            );

            await i.update({
                embeds: [confirmEmbed],
                components: [confirmRow]
            });
        } else if (i.isButton()) {
            if (i.customId === 'confirm_inimigo_sim') {
                if (selectedIds.length > 0) {
                    try {
                        const placeholders = selectedIds.map(() => '?').join(',');
                        db.prepare(`DELETE FROM lista_ficha_inimigos WHERE id IN (${placeholders})`).run(...selectedIds);
                    } catch (err) {
                        console.error('Erro ao deletar inimigos:', err);
                    }
                }

                const successEmbed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('✅ Inimigos Deletados')
                    .setDescription(`As fichas selecionadas foram deletadas com sucesso do servidor!`);

                    await i.update({ embeds: [successEmbed], components: [] });
                    collector.stop();
                } else if (i.customId === 'confirm_inimigo_nao') {
                    const cancelEmbed = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('❌ Operação Cancelada')
                        .setDescription('Nenhuma ficha foi deletada.');

                    await i.update({ embeds: [cancelEmbed], components: [] });
                    collector.stop();
                }
            }
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') {
            try { await interaction.editReply({ components: [] }).catch(() => {}); } catch (e) {}
        }
    });
}

module.exports = {
    executarDeletarInimigo
};