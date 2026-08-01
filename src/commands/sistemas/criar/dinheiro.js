const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const sessionManager = require('./sessionManager');
const atributosHandler = require('./atributos');

async function editarMensagemUnica(channelOrInteraction, session, embed, row = null) {
    try {
        let msg = null;
        const payload = { embeds: [embed], components: row ? [row] : [] };

        if (channelOrInteraction && typeof channelOrInteraction.update === 'function') {
            if (!channelOrInteraction.deferred && !channelOrInteraction.replied) {
                msg = await channelOrInteraction.update({ ...payload }).catch(() => null);
            } else {
                msg = await channelOrInteraction.editReply(payload).catch(() => null);
            }
        }

        if (!msg && session.lastInteraction && typeof session.lastInteraction.editReply === 'function') {
            msg = await session.lastInteraction.editReply(payload).catch(() => null);
        }

        if (!msg) {
            const targetChannel = (channelOrInteraction && typeof channelOrInteraction.send === 'function' ? channelOrInteraction : null) ||
                                  (channelOrInteraction && channelOrInteraction.channel) || 
                                  (session.lastInteraction && session.lastInteraction.channel);
            if (targetChannel && typeof targetChannel.send === 'function') {
                msg = await targetChannel.send(payload).catch(() => null);
            }
        }

        if (msg) {
            sessionManager.salvarMensagemAtual(session, msg);
        }
        return msg;
    } catch (err) {
        console.error('Erro ao editar mensagem em dinheiro.js:', err);
    }
}

async function iniciarDinheiro(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('💰 Sistema de Dinheiro / Moedas')
        .setDescription('Seu sistema possui dinheiro? E ele é dividido em vários nomes?\n\n💡 *Exemplo: D&D possui moedas como PO (Peças de Ouro), PP (Peças de Prata), PC (Peças de Cobre), etc.*');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_dinheiro_opcao')
            .setPlaceholder('Escolha a opção de dinheiro...')
            .addOptions([
                { label: 'Sim, possui dinheiro com varios nomes', value: 'varios' },
                { label: 'Sim, possui dinheiro com apenas um nome (tipo dolar)', value: 'unico' },
                { label: 'Não possui dinheiro', value: 'nao' }
            ])
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

async function tratarInteracao(interaction) {
    const session = sessionManager.getSession(interaction.user.id);
    if (!session) return false;

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_dinheiro_opcao') {
        const valor = interaction.values[0];
        session.data.dinheiroOpcao = valor;

        if (valor === 'varios') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('💰 Nomes dos Dinheiros (Múltiplos)')
                .setDescription('Escreva, em ordem, o nome dos dinheiros do valor mais baixo ao mais alto.\n\n💡 *Exemplo: `PC: Peças de cobre, PP: Peças de prata, PO: Peças de ouro`*.\n\nEnvie no chat no formato `Nome:descrição`:');

            await editarMensagemUnica(interaction, session, embed, null);
            sessionManager.resetarFlagsTexto(session);
            session.waitingForDinheiroVarios = true;
            return true;
        }

        if (valor === 'unico') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('💰 Nome do Dinheiro (Único)')
                .setDescription('Qual vai ser o nome do dinheiro no seu sistema?\n\n💡 *Exemplo: Dólar, Real, Ouro, Coroas, etc.* Envie apenas o nome no chat:');

            await editarMensagemUnica(interaction, session, embed, null);
            sessionManager.resetarFlagsTexto(session);
            session.waitingForDinheiroUnico = true;
            return true;
        }

        if (valor === 'nao') {
            session.data.dinheiroConfig = 'Não possui dinheiro';
            sessionManager.resetarFlagsTexto(session);
            return await atributosHandler.iniciarAtributosSimNao(interaction, session);
        }
    }

    return false;
}

async function processarDinheiroTexto(message, session) {
    const texto = message.content.trim();
    if (!texto) return false;

    // Salva o dado na sessão
    if (session.waitingForDinheiroVarios) {
        session.data.dinheiroConfig = texto;
        session.waitingForDinheiroVarios = false;
    } else if (session.waitingForDinheiroUnico) {
        session.data.dinheiroConfig = texto;
        session.waitingForDinheiroUnico = false;
    } else {
        return false;
    }

    // Tenta apagar a mensagem enviada pelo usuário para manter o chat limpo
    try {
        await message.delete();
    } catch (e) {
        // Ignora caso não consiga apagar
    }

    sessionManager.resetarFlagsTexto(session);

    // Pega o canal correto para enviar a próxima etapa (Atributos)
    const channelOrInteraction = session.lastInteraction || message.channel;
    
    // Avança para a próxima etapa chamando os atributos corretamente
    if (typeof atributosHandler.iniciarAtributosSimNao === 'function') {
        return await atributosHandler.iniciarAtributosSimNao(channelOrInteraction, session);
    }

    return true;
}

module.exports = {
    iniciarDinheiro,
    tratarInteracao,
    processarDinheiroTexto
};