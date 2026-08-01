const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');

function safeTruncate(str, maxLength = 100) {
    if (!str || typeof str !== 'string') return 'Avatar sem nome';
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}

module.exports = async (interaction) => {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    let tuppers = [];

    try {
        tuppers = db.prepare('SELECT * FROM tuppers WHERE userId = ? AND (isGlobal = 1 OR guildId = ?)').all(userId, guildId);
    } catch (e) {
        tuppers = [];
    }

    const initialEmbed = new EmbedBuilder()
        .setTitle('🟢 Ativar Avatar')
        .setDescription('Selecione abaixo qual avatar você deseja ativar neste canal:')
        .setColor(0x5865F2);

    if (!tuppers || tuppers.length === 0) {
        initialEmbed.setDescription('❌ Você não possui nenhum avatar disponível para ativar!');
        initialEmbed.setColor(0xED4245);
        return interaction.reply({ embeds: [initialEmbed], flags: [MessageFlags.Ephemeral] });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_tupper_ativar')
        .setPlaceholder('Selecione o avatar para ativar...')
        .addOptions(
            tuppers.slice(0, 25).map(t => {
                let displayName = safeTruncate(t.nome, 100);
                let desc = safeTruncate(`Prefixo: ${t.prefixo || 'Nenhum'}`, 100);

                return new StringSelectMenuOptionBuilder()
                    .setLabel(displayName)
                    .setDescription(desc)
                    .setValue(String(t.id));
            })
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        embeds: [initialEmbed],
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 60000, max: 1 });

    collector.on('collect', async i => {
        if (!i.isStringSelectMenu()) return;
        const tupperId = i.values[0];
        const tupper = db.prepare('SELECT * FROM tuppers WHERE id = ? AND userId = ?').get(tupperId, userId);

        if (!tupper) {
            const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription('Avatar não encontrado.').setColor(0xED4245);
            return i.update({ embeds: [errEmbed], components: [] });
        }

        try {
            db.prepare('INSERT OR IGNORE INTO active_channels (guildId, channelId) VALUES (?, ?)').run(guildId, interaction.channel.id);
            db.prepare(`
                INSERT INTO active_tuppers (userId, guildId, tupperId) 
                VALUES (?, ?, ?) 
                ON CONFLICT(userId, guildId) DO UPDATE SET tupperId = ?
            `).run(userId, guildId, tupper.id, tupper.id);
        } catch (e) {}

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Avatar Ativado!')
            .setDescription(`O avatar **${safeTruncate(tupper.nome, 50)}** foi ativado com sucesso neste canal!`)
            .setColor(0x57F287);

        if (tupper.fotoUrl && (tupper.fotoUrl.startsWith('http://') || tupper.fotoUrl.startsWith('https://'))) {
            successEmbed.setThumbnail(tupper.fotoUrl);
        }

        await i.update({ embeds: [successEmbed], components: [] });
    });
};