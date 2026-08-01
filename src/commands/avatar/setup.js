const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database');

module.exports = async (interaction) => {
    // Verificação de permissão (Admin ou cargo 'GM')
    if (!interaction.member.permissions.has('Administrator') && !interaction.member.roles.cache.some(r => r.name === 'GM')) {
        const errEmbed = new EmbedBuilder()
            .setTitle('🚫 Permissão Negada')
            .setDescription('Apenas quem possui o cargo **GM** pode usar este comando.')
            .setColor(0xED4245);
        return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }

    // Garante que a tabela active_channels existe no banco de dados SQLite
    db.prepare(`
        CREATE TABLE IF NOT EXISTS active_channels (
            guildId TEXT,
            channelId TEXT,
            PRIMARY KEY (guildId, channelId)
        )
    `).run();

    // Filtra apenas canais de texto do servidor
    const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());

    // Função para atualizar as opções do menu com base no banco atual
    const updateMenu = () => {
        const activeChannels = db.prepare('SELECT channelId FROM active_channels WHERE guildId = ?').all(interaction.guild.id).map(r => r.channelId);
        
        const options = channels.map(c => {
            const isActive = activeChannels.includes(c.id);
            return {
                label: c.name.slice(0, 100),
                value: c.id,
                description: isActive ? '🟢 Ativado' : '🔴 Desativado',
            };
        }).slice(0, 25); // O Discord permite no máximo 25 opções em selects

        return new StringSelectMenuBuilder()
            .setCustomId('setup_channels_menu')
            .setPlaceholder('Selecione um canal para alternar o status')
            .addOptions(options);
    };

    const setupEmbed = new EmbedBuilder()
        .setTitle('⚙️ Setup de Canais Ativos')
        .setDescription('Selecione abaixo os canais onde o sistema de avatar deve ser ativado/desativado.\n\n*Assim que terminar, basta ignorar esta mensagem ou fechar o painel.*')
        .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(updateMenu());
    const response = await interaction.reply({ embeds: [setupEmbed], components: [row], ephemeral: true });

    // Coletor para interações do menu de seleção
    const collector = response.createMessageComponentCollector({ time: 900000 }); // 15 minutos

    collector.on('collect', async i => {
        if (!i.isStringSelectMenu()) return;

        const channelId = i.values[0];
        const existing = db.prepare('SELECT * FROM active_channels WHERE guildId = ? AND channelId = ?').get(interaction.guild.id, channelId);

        if (existing) {
            db.prepare('DELETE FROM active_channels WHERE guildId = ? AND channelId = ?').run(interaction.guild.id, channelId);
        } else {
            db.prepare('INSERT INTO active_channels (guildId, channelId) VALUES (?, ?)').run(interaction.guild.id, channelId);
        }

        const newRow = new ActionRowBuilder().addComponents(updateMenu());
        await i.update({ embeds: [setupEmbed], components: [newRow] });
    });

    collector.on('end', async () => {
        try {
            const disabledRow = new ActionRowBuilder().addComponents(
                updateMenu().setDisabled(true)
            );
            await interaction.editReply({ components: [disabledRow] }).catch(() => {});
        } catch (e) {}
    });
};