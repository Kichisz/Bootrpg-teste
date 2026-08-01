const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../../../database');
const sessionCriarficha = require('./sessionCriarficha');

async function iniciarCriacao(interaction) {
    const activeRow = db.prepare('SELECT systemId FROM guild_active_system WHERE guildId = ?').get(interaction.guild.id);
    if (!activeRow) {
        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('⚠️ Nenhum Sistema Ativo')
            .setDescription('Ative um sistema de RPG neste servidor antes de criar NPCs ou Inimigos.');
        return await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    const dirPath = path.join(process.cwd(), 'configs_npcs');
    let configs = [];

    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8'));
                    if (
                        parsed.guildId === interaction.guild.id &&
                        parsed.userId === interaction.user.id &&
                        parsed.systemId === activeRow.systemId
                    ) {
                        configs.push(parsed);
                    }
                } catch (e) {}
            }
        }
    }

    if (configs.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('⚠️ Nenhuma Configuração Encontrada')
            .setDescription('Você precisa criar ao menos uma configuração usando `/criador configurar` antes de gerar fichas com IA.');
        return await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    const session = sessionCriarficha.getSession(interaction.user.id);
    session.interaction = interaction;
    session.systemId = activeRow.systemId;
    session.step = 'ESCOLHER_CONFIG';

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('criarficha_config_select')
        .setPlaceholder('Escolha a configuração...')
        .addOptions(
            configs.slice(0, 25).map(c => ({
                label: String(c.configName).substring(0, 100),
                value: String(c.id)
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador Automático de Fichas (IA)')
        .setDescription('Escolha abaixo a configuração de limites que deseja usar para esta criação:');

    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });
}

async function lidarComConfig(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'criarficha_config_select') return false;
    await interaction.deferUpdate();

    const session = sessionCriarficha.getSession(interaction.user.id);
    session.interaction = interaction;
    session.data.configId = interaction.values[0];

    const { pedirTipo } = require('./etapaTipo');
    await pedirTipo(interaction, session);
    return true;
}

module.exports = {
    iniciarCriacao,
    lidarComConfig
};