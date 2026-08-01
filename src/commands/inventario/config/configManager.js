const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const dbManager = require('../database/dbManager');
const pesoConfigHandler = require('./pesoConfig');
const quantiaConfigHandler = require('./quantiaConfig');

const pendingConfirmations = new Map();

async function iniciarConfiguracao(interaction, session) {
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⚠️ Configuração do Inventário')
        .setDescription('Este comando é para adicionar uma (ou mais) limitações para o inventário dos players. Tem certeza que deseja adicionar isso?');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('inv_conf_sim').setLabel('Sim').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('inv_conf_nao').setLabel('Não').setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function tratarInteracaoConfig(interaction, session) {
    if (interaction.isButton()) {
        if (interaction.customId === 'inv_conf_sim') {
            const sistemaAtivo = dbManager.getSistemaAtivo();
            if (!sistemaAtivo) {
                return await interaction.update({ content: '❌ Nenhum sistema de RPG ativo neste servidor!', embeds: [], components: [] });
            }

            const configAtual = dbManager.carregarConfigSistema(sistemaAtivo.nomeSistema) || {};
            const pesoAtivo = configAtual.pesoAtivo ? '🟢 Ativo' : '🔴 Desativado';
            const quantiaAtiva = configAtual.quantiaAtiva ? '🟢 Ativo' : '🔴 Desativado';

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('⚙️ Seleção de Sistemas de Limitação')
                .setDescription(`Sistema Ativo: **${sistemaAtivo.nomeSistema}**\nQuais sistemas deseja adicionar para limitar o inventário?`);

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('inv_select_limites')
                    .setPlaceholder('Selecione os sistemas de limitação...')
                    .setMinValues(1)
                    .setMaxValues(2)
                    .addOptions([
                        { label: 'Peso máximo', description: `${pesoAtivo}`, value: 'peso' },
                        { label: 'Limite de itens', description: `${quantiaAtiva}`, value: 'quantia' }
                    ])
            );

            await interaction.update({ embeds: [embed], components: [row] });
            return true;
        }

        if (interaction.customId === 'inv_conf_nao') {
            await interaction.update({ content: '❌ Configuração de inventário cancelada.', embeds: [], components: [] });
            return true;
        }

        if (interaction.customId === 'inv_ativar_sim') {
            const dados = pendingConfirmations.get(interaction.user.id);
            if (!dados) return await interaction.update({ content: '⚠️ Sessão expirada.', embeds: [], components: [] });

            const sistemaAtivo = dbManager.getSistemaAtivo();
            let config = dbManager.carregarConfigSistema(sistemaAtivo.nomeSistema) || {};
            
            config.pesoAtivo = dados.selecionados.includes('peso');
            config.quantiaAtiva = dados.selecionados.includes('quantia');
            dbManager.salvarConfigSistema(sistemaAtivo.nomeSistema, config);

            pendingConfirmations.delete(interaction.user.id);

            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('🟢 Limitações Ativadas com Sucesso')
                .setDescription(`Os seguintes sistemas foram ativados: **${dados.nomes.join(', ')}**.`);

            await interaction.update({ embeds: [embed], components: [] });
            return true;
        }

        if (interaction.customId === 'inv_ativar_nao') {
            pendingConfirmations.delete(interaction.user.id);
            await interaction.update({ content: '❌ Ativação de limitações cancelada.', embeds: [], components: [] });
            return true;
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'inv_select_limites') {
        const selecionados = interaction.values;
        const nomes = selecionados.map(s => s === 'peso' ? 'Peso máximo' : 'Limite de itens');
        pendingConfirmations.set(interaction.user.id, { selecionados, nomes });

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ Confirmar Ativação')
            .setDescription(`Deseja mesmo ativar **${nomes.join(' e ')}** como limitação de inventário?`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('inv_ativar_sim').setLabel('Sim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('inv_ativar_nao').setLabel('Não').setStyle(ButtonStyle.Danger)
        );

        await interaction.update({ embeds: [embed], components: [row] });
        return true;
    }

    return false;
}

module.exports = { iniciarConfiguracao, tratarInteracaoConfig };