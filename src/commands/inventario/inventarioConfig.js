const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const dbManager = require('./database/dbManager');
const pesoConfigHandler = require('./config/pesoConfig');
const quantiaConfigHandler = require('./config/quantiaConfig');
const punicaoConfigHandler = require('./config/punicaoConfig');

// Mapa global de sessões vinculado ao ID do usuário para não perder dados no chat
const configSessions = new Map();

async function execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const tipo = interaction.options.getString('tipo');
    const userId = interaction.user.id;
    
    let session = configSessions.get(userId) || {};
    configSessions.set(userId, session);

    if (!tipo) {
        const sistemaAtivo = dbManager.getSistemaAtivo();
        if (!sistemaAtivo) {
            return interaction.editReply({ content: '❌ Nenhum sistema de RPG ativo neste servidor!' });
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

        return interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (tipo === 'peso') {
        return pesoConfigHandler.iniciarConfigPeso(interaction, session);
    } else if (tipo === 'quantia') {
        return quantiaConfigHandler.iniciarConfigQuantia(interaction, session);
    }
}

async function handleInteractions(interaction) {
    const userId = interaction.user.id;
    let session = configSessions.get(userId) || {};
    configSessions.set(userId, session);

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.customId === 'inv_select_limites' || interaction.customId === 'inv_conf_sim' || interaction.customId === 'inv_conf_nao' || interaction.customId === 'inv_ativar_sim' || interaction.customId === 'inv_ativar_nao') {
            const { tratarInteracaoConfig } = require('./config/configManager');
            return await tratarInteracaoConfig(interaction, session);
        }
        if (interaction.customId.startsWith('inv_config_peso_') || interaction.customId === 'inv_config_punicao_escolha') {
            return await pesoConfigHandler.tratarInteracaoPeso(interaction, session);
        }
    }
    return false;
}

async function handleMessages(message) {
    if (message.author.bot) return false;
    const userId = message.author.id;
    const session = configSessions.get(userId);
    if (!session) return false;

    // Tenta processar o texto digitado nas etapas de configuração ativas
    if (await pesoConfigHandler.processarPesoTexto(message, session)) {
        configSessions.delete(userId);
        return true;
    }
    if (await punicaoConfigHandler.processarPunicaoTexto(message, session)) {
        configSessions.delete(userId);
        return true;
    }
    if (await quantiaConfigHandler.processarQuantiaTexto(message, session)) {
        configSessions.delete(userId);
        return true;
    }

    return false;
}

module.exports = {
    execute,
    handleInteractions,
    handleMessages,
    getSistemaAtivo: dbManager.getSistemaAtivo
};