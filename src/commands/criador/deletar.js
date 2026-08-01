const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../../database');

async function deletarConfiguracao(interaction) {
    const activeRow = db.prepare('SELECT systemId FROM guild_active_system WHERE guildId = ?').get(interaction.guild.id);
    if (!activeRow) {
        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('⚠️ Nenhum Sistema Ativo')
            .setDescription('Ative um sistema de RPG no servidor primeiro para poder deletar configurações.');
        return await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    const dirPath = path.join(process.cwd(), 'configs_npcs');
    let configs = [];

    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const filePath = path.join(dirPath, file);
                    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                    if (
                        parsed.guildId === interaction.guild.id &&
                        parsed.userId === interaction.user.id &&
                        parsed.systemId === activeRow.systemId
                    ) {
                        configs.push(parsed);
                    }
                } catch (e) {
                    console.error(`Erro ao ler arquivo de config para deleção ${file}:`, e);
                }
            }
        }
    }

    if (!configs || configs.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ Nenhuma Configuração Encontrada')
            .setDescription('Você não possui nenhuma configuração de NPCs salva para este sistema ativo neste servidor.');
        return await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('criador_deletar_select')
        .setPlaceholder('Escolha uma configuração para deletar...')
        .addOptions(
            configs.slice(0, 25).map(c => ({
                label: String(c.configName).substring(0, 100),
                value: String(c.id),
                description: `Criado em: ${new Date(c.criadoEm).toLocaleDateString()}`
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🗑️ Deletar Configuração de NPCs')
        .setDescription('Selecione abaixo no menu a configuração que deseja **deletar permanentemente**:');

    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });
}

async function lidarComDelecao(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'criador_deletar_select') return false;

    await interaction.deferUpdate();
    const configId = interaction.values[0];

    const dirPath = path.join(process.cwd(), 'configs_npcs');
    const filePath = path.join(dirPath, `${configId}.json`);

    if (!fs.existsSync(filePath)) {
        return interaction.editReply({ content: '❌ Arquivo de configuração não encontrado ou já foi deletado.', embeds: [], components: [] });
    }

    let configRow = {};
    try {
        configRow = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return interaction.editReply({ content: '❌ Erro ao ler os dados do arquivo para deleção.', embeds: [], components: [] });
    }

    if (configRow.userId !== interaction.user.id) {
        return interaction.editReply({ content: '❌ Você não tem permissão para deletar esta configuração.', embeds: [], components: [] });
    }

    try {
        // Deleta o arquivo físico JSON solto
        fs.unlinkSync(filePath);

        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Configuração Deletada')
            .setDescription(`A configuração **"${configRow.configName}"** foi deletada com sucesso do sistema!`);

        await interaction.editReply({ embeds: [embed], components: [] });
    } catch (err) {
        console.error('Erro ao apagar arquivo JSON de configuração:', err);
        await interaction.editReply({ content: '❌ Ocorreu um erro ao tentar deletar o arquivo.', embeds: [], components: [] });
    }

    return true;
}

module.exports = {
    deletarConfiguracao,
    lidarComDelecao
};