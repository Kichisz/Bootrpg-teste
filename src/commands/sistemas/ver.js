const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database');

module.exports = async function(interaction) {
    const sistemas = db.prepare('SELECT * FROM rpg_systems WHERE userId = ?').all(interaction.user.id);

    if (sistemas.length === 0) {
        return interaction.reply({ content: '❌ Você ainda não criou nenhum sistema de RPG.', flags: 64 });
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId('rpg_ver_detalhes')
        .setPlaceholder('Escolha um sistema para ver os detalhes')
        .addOptions(sistemas.map(s => ({ label: s.nomeSistema, value: String(s.id) })));

    return interaction.reply({
        content: '📜 **Seus Sistemas Criados:**',
        components: [new ActionRowBuilder().addComponents(select)],
        flags: 64
    });
};