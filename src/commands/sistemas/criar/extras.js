const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../../../database');
const sessionManager = require('./sessionManager');

async function perguntarSeGuardaElementos(channelOrInteraction, session) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('rpg_setup_extras_sim')
            .setLabel('Sim')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('rpg_setup_extras_nao')
            .setLabel('Não')
            .setStyle(ButtonStyle.Danger)
    );

    const content = '🧩 **Elementos Personalizados na Ficha**\nDeseja que seu sistema guarde o nome de magias, talentos, habilidades e etc. dentro da ficha?';

    if (channelOrInteraction.user || channelOrInteraction.author) {
        sessionManager.salvarMensagemAtual(session, channelOrInteraction);
    }

    try {
        if (session.lastInteraction && typeof session.lastInteraction.editReply === 'function') {
            await session.lastInteraction.editReply({ content, components: [row], embeds: [] });
            return;
        }

        if (channelOrInteraction.deferred || channelOrInteraction.replied) {
            await channelOrInteraction.editReply({ content, components: [row], embeds: [] });
        } else if (typeof channelOrInteraction.update === 'function') {
            await channelOrInteraction.update({ content, components: [row], embeds: [] });
        } else if (typeof channelOrInteraction.editReply === 'function') {
            await channelOrInteraction.editReply({ content, components: [row], embeds: [] });
        } else {
            const channel = channelOrInteraction.channel || channelOrInteraction;
            const msg = await channel.send({ content, components: [row] });
            sessionManager.salvarMensagemAtual(session, msg);
        }
    } catch (err) {
        const channel = channelOrInteraction.channel || (channelOrInteraction.client && channelOrInteraction.client.channels.cache.get(channelOrInteraction.channelId));
        if (channel && typeof channel.send === 'function') {
            const msg = await channel.send({ content, components: [row] });
            sessionManager.salvarMensagemAtual(session, msg);
        }
    }
}

async function salvarSistemaFinal(channelOrInteraction, session, messageToDelete = null) {
    try {
        if (messageToDelete) {
            try { await messageToDelete.delete(); } catch (e) {}
        }

        const nomeSistema = session.data.nomeSistema || 'Sistema Personalizado';
        const userId = session.userId || channelOrInteraction.user?.id || channelOrInteraction.author?.id;
        const configJson = JSON.stringify(session.data);

        db.prepare(`
            INSERT INTO rpg_systems (userId, nomeSistema, config) 
            VALUES (?, ?, ?)
        `).run(userId, nomeSistema, configJson);

        const recursosExtrasStr = session.data.recursosExtrasConfig?.length > 0 
            ? session.data.recursosExtrasConfig.map(r => `${r.nome} (${r.representacao}, ${r.fluxo}, ${r.tipo})`).join(', ') 
            : 'Nenhum';

        const elementosStr = session.data.elementosCustomizados?.length > 0
            ? session.data.elementosCustomizados.join(', ')
            : 'Nenhum';

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 Sistema de RPG Criado com Sucesso!')
            .setDescription(
                `O sistema **${nomeSistema}** foi totalmente configurado, salvo e registrado no banco de dados!\n\n` +
                `📋 **Resumo Completo:**\n` +
                `- **Dinheiro:** ${session.data.dinheiroConfig || 'Não informado'}\n` +
                `- **Atributos:** ${session.data.temAtributos ? (session.data.atributosLista?.join(', ') || 'Sim') : 'Não'}\n` +
                `- **Perícias:** ${session.data.temPericias ? session.data.nomePericias : 'Não'}\n` +
                `- **Vida (PV):** ${session.data.temPv ? session.data.pvNome : 'Não'}\n` +
                `- **Mana (PM):** ${session.data.temPm ? session.data.pmNome : 'Não'}\n` +
                `- **Recursos Extras:** ${recursosExtrasStr}\n` +
                `- **Defesa (CA):** ${session.data.temCa ? session.data.caNome : 'Não'}\n` +
                `- **Elementos Personalizados:** ${elementosStr}\n` +
                `- **Dados:** Combate (${session.data.dadoCombate}) | Perícias (${session.data.dadoPericia})\n\n` +
                `Use o comando de ativação para começar a usá-lo neste servidor!`
            );

        if (session.lastInteraction && typeof session.lastInteraction.editReply === 'function') {
            await session.lastInteraction.editReply({ embeds: [embed], components: [], content: null }).catch(async () => {
                const channel = channelOrInteraction.channel;
                if (channel) await channel.send({ embeds: [embed], components: [] });
            });
        } else if (channelOrInteraction.deferred || channelOrInteraction.replied) {
            await channelOrInteraction.editReply({ embeds: [embed], components: [], content: null });
        } else if (channelOrInteraction.editReply) {
            await channelOrInteraction.editReply({ embeds: [embed], components: [], content: null });
        } else {
            const channel = channelOrInteraction.channel || channelOrInteraction;
            await channel.send({ embeds: [embed], components: [] });
        }

        sessionManager.limparSessao(userId);
    } catch (err) {
        console.error('Erro ao salvar sistema no banco de dados em extras.js:', err);
        const embedError = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Erro ao Salvar Sistema')
            .setDescription('Ocorreu um erro ao salvar o sistema no banco de dados.');
        
        const channel = channelOrInteraction.channel || (session.lastInteraction && session.lastInteraction.channel);
        if (channel) {
            await channel.send({ embeds: [embedError] }).catch(() => {});
        }
    }
}

async function tratarBotaoExtras(interaction, session) {
    const customId = interaction.customId;
    if (!customId.startsWith('rpg_setup_extras_')) return false;

    if (customId === 'rpg_setup_extras_sim') {
        session.waitingForElementosCustomizados = true;
        const content = '📝 **Elementos Personalizados**\nDigite os nomes dos elementos separados por vírgula (ex: Magias, Talentos, Habilidades):';
        
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content, components: [] });
        } else {
            await interaction.update({ content, components: [] });
        }
        return true;
    } 
    
    if (customId === 'rpg_setup_extras_nao') {
        session.waitingForElementosCustomizados = false;
        session.data.elementosCustomizados = [];
        await salvarSistemaFinal(interaction, session);
        return true;
    }

    return false;
}

async function tratarTextoExtras(message, session) {
    if (!session.waitingForElementosCustomizados) return false;

    const texto = message.content.trim();
    const elementos = texto.split(',').map(e => e.trim()).filter(Boolean);

    session.waitingForElementosCustomizados = false;
    session.data.elementosCustomizados = elementos;

    await salvarSistemaFinal(message, session, message);
    return true;
}

module.exports = {
    perguntarSeGuardaElementos,
    salvarSistemaFinal,
    tratarBotaoExtras,
    tratarTextoExtras
};