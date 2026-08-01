const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../../database'); // Mantido caso precise checar o sistema ativo no banco

async function listarConfiguracoes(interaction) {
    const activeRow = db.prepare('SELECT systemId FROM guild_active_system WHERE guildId = ?').get(interaction.guild.id);
    if (!activeRow) {
        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('⚠️ Nenhum Sistema Ativo')
            .setDescription('Ative um sistema de RPG no servidor primeiro para ver as configurações.');
        return await interaction.reply({ embeds: [embed], flags: [64] });
    }

    // Pasta onde os arquivos JSON estão salvos
    const dirPath = path.join(process.cwd(), 'configs_npcs');
    let configs = [];

    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const filePath = path.join(dirPath, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const parsed = JSON.parse(content);

                    // Filtra rigorosamente por Servidor, Usuário e Sistema Ativo atual
                    if (
                        parsed.guildId === interaction.guild.id &&
                        parsed.userId === interaction.user.id &&
                        parsed.systemId === activeRow.systemId
                    ) {
                        configs.push(parsed);
                    }
                } catch (e) {
                    console.error(`Erro ao ler arquivo de config ${file}:`, e);
                }
            }
        }
    }

    if (!configs || configs.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ Nenhuma Configuração')
            .setDescription('Você ainda não criou nenhuma configuração de NPCs para este sistema específico neste servidor. Use `/criador configurar` primeiro.');
        return await interaction.reply({ embeds: [embed], flags: [64] });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('criador_ver_detalhes')
        .setPlaceholder('Escolha uma configuração para ver detalhes...')
        .addOptions(
            configs.slice(0, 25).map(c => ({
                label: String(c.configName).substring(0, 100),
                value: String(c.id)
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📜 Suas Configurações de NPCs')
        .setDescription('Selecione abaixo no menu a configuração que deseja inspecionar detalhadamente:');

    await interaction.reply({ embeds: [embed], components: [row], flags: [64] });
}

async function lidarComDetalhes(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'criador_ver_detalhes') return false;

    await interaction.deferUpdate();
    const configId = interaction.values[0];

    const dirPath = path.join(process.cwd(), 'configs_npcs');
    const filePath = path.join(dirPath, `${configId}.json`);

    if (!fs.existsSync(filePath)) {
        return interaction.editReply({ content: '❌ Arquivo de configuração não encontrado.', embeds: [], components: [] });
    }

    let configRow = {};
    try {
        configRow = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return interaction.editReply({ content: '❌ Erro ao ler os dados do arquivo.', embeds: [], components: [] });
    }

    if (configRow.userId !== interaction.user.id) {
        return interaction.editReply({ content: '❌ Você não tem permissão para ver esta configuração.', embeds: [], components: [] });
    }

    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`🔍 Detalhes da Configuração: ${configRow.configName}`)
        .setDescription(
            `**ID do Arquivo:** \`${configRow.id}\`\n` +
            `**Sistema ID:** \`${configRow.systemId}\`\n` +
            `**Criado em:** \`${new Date(configRow.criadoEm).toLocaleString()}\`\n\n` +
            `**Dados Salvos (Limites para a IA):**\n\`\`\`json\n${JSON.stringify(configRow.configData, null, 2)}\n\`\`\``
        );

    await interaction.editReply({ embeds: [embed], components: [] });
    return true;
}

module.exports = {
    listarConfiguracoes,
    lidarComDetalhes
};