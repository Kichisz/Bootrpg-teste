const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

async function pedirTipo(interaction, session) {
    session.step = 'ESCOLHER_TIPO';

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('criarficha_tipo_select')
        .setPlaceholder('Selecione o tipo...')
        .addOptions([
            { label: 'Inimigo', value: 'inimigo', description: 'Será salvo na database de inimigos' },
            { label: 'NPC', value: 'npc', description: 'Será salvo na database de NPCs (privado)' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador de Fichas — Tipo')
        .setDescription('Você está criando um **Inimigo** ou um **NPC**?');

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function lidarComTipo(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'criarficha_tipo_select') return false;
    await interaction.deferUpdate();

    const session = require('./sessionCriarficha').getSession(interaction.user.id);
    session.interaction = interaction;
    const escolha = interaction.values[0];

    session.data.tipo = escolha;
    session.data.tableName = escolha === 'inimigo' ? 'lista-ficha-inimigos' : 'lista-ficha-npcs';

    const { pedirNome } = require('./etapaNome');
    await pedirNome(interaction, session);
    return true;
}

module.exports = {
    pedirTipo,
    lidarComTipo
};