const { EmbedBuilder, MessageFlags } = require('discord.js');

const sessions = new Map();

function getSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, {
            userId: userId,
            data: {},
            lastMessageId: null,
            lastInteraction: null,
            waitingForName: false,
            waitingForDinheiroVarios: false,
            waitingForDinheiroUnico: false,
            waitingForAtribNomes: false,
            waitingForAtribBase: false,
            waitingForAtribPasso: false,
            waitingForBolinhasMax: false,
            waitingForEscalaMax: false,
            waitingForPericiasNome: false,
            waitingForPericiasLista: false,
            waitingForPericiasBolinhasMax: false,
            waitingForPericiasEscalaMax: false,
            waitingForPvNome: false,
            waitingForPmNome: false,
            waitingForCaNome: false,
            waitingForRecursosExtrasNomes: false,
            waitingForElementosCustomizados: false,
            waitingForDadoUnico: false,
            waitingForDadoCombate: false,
            waitingForDadoPericia: false,
            waitingForAtribCatNomes: false,
            waitingForPericiaCatNomes: false,
            waitingForXpLinear: false,
            waitingForXpExponencialManual: false,
            waitingForXpBaseMultiplicador: false,
            waitingForXpFatorMultiplicador: false,
            waitingForXpMaxNiveisMultiplicador: false,
            waitingForAtribNiveisFreq: false,
            waitingForAtribPontosQtd: false,
            waitingForPericiaNiveisFreq: false,
            waitingForPericiaPontosQtd: false,
            waitingForAmbosAtribNiveisFreq: false,
            waitingForAmbosAtribPontosQtd: false,
            waitingForAmbosPericiaNiveisFreq: false,
            waitingForAmbosPericiaPontosQtd: false,
            waitingForGradUparNivel: false,
            waitingForGradValorFixo: false,
            waitingForGradBase: false,
            waitingForGradPassoNiveis: false,
            waitingForGradIncremento: false,
            waitingForEdicaoAtribNomes: false,
            waitingForEdicaoPericiasNomes: false,
            waitingForEdicaoPvNome: false,
            waitingForEdicaoPmNome: false,
            waitingForEdicaoRecursosExtrasNomes: false,
            waitingForEdicaoCaNome: false,
            waitingForEdicaoXpLinear: false,
            waitingForEdicaoXpExponencial: false,
            waitingForEdicaoXpBaseMult: false
        });
    }
    return sessions.get(userId);
}

function setSession(userId, sessionData) {
    sessions.set(userId, {
        userId: userId,
        ...sessionData
    });
    return sessions.get(userId);
}

function resetarFlagsTexto(session) {
    session.waitingForName = false;
    session.waitingForDinheiroVarios = false;
    session.waitingForDinheiroUnico = false;
    session.waitingForAtribNomes = false;
    session.waitingForAtribBase = false;
    session.waitingForAtribPasso = false;
    session.waitingForBolinhasMax = false;
    session.waitingForEscalaMax = false;
    session.waitingForPericiasNome = false;
    session.waitingForPericiasLista = false;
    session.waitingForPericiasBolinhasMax = false;
    session.waitingForPericiasEscalaMax = false;
    session.waitingForPvNome = false;
    session.waitingForPmNome = false;
    session.waitingForCaNome = false;
    session.waitingForRecursosExtrasNomes = false;
    session.waitingForElementosCustomizados = false;
    session.waitingForDadoUnico = false;
    session.waitingForDadoCombate = false;
    session.waitingForDadoPericia = false;
    session.waitingForAtribCatNomes = false;
    session.waitingForPericiaCatNomes = false;
    session.waitingForXpLinear = false;
    session.waitingForXpExponencialManual = false;
    session.waitingForXpBaseMultiplicador = false;
    session.waitingForXpFatorMultiplicador = false;
    session.waitingForXpMaxNiveisMultiplicador = false;
    session.waitingForAtribNiveisFreq = false;
    session.waitingForAtribPontosQtd = false;
    session.waitingForPericiaNiveisFreq = false;
    session.waitingForPericiaPontosQtd = false;
    session.waitingForAmbosAtribNiveisFreq = false;
    session.waitingForAmbosAtribPontosQtd = false;
    session.waitingForAmbosPericiaNiveisFreq = false;
    session.waitingForAmbosPericiaPontosQtd = false;
    session.waitingForGradUparNivel = false;
    session.waitingForGradValorFixo = false;
    session.waitingForGradBase = false;
    session.waitingForGradPassoNiveis = false;
    session.waitingForGradIncremento = false;
    session.waitingForEdicaoAtribNomes = false;
    session.waitingForEdicaoPericiasNomes = false;
    session.waitingForEdicaoPvNome = false;
    session.waitingForEdicaoPmNome = false;
    session.waitingForEdicaoRecursosExtrasNomes = false;
    session.waitingForEdicaoCaNome = false;
    session.waitingForEdicaoXpLinear = false;
    session.waitingForEdicaoXpExponencial = false;
    session.waitingForEdicaoXpBaseMult = false;
}

function salvarMensagemAtual(session, messageOrInteraction) {
    if (messageOrInteraction) {
        if (messageOrInteraction.id) {
            session.lastMessageId = messageOrInteraction.id;
        }
        if (typeof messageOrInteraction.editReply === 'function') {
            session.lastInteraction = messageOrInteraction;
        }
    }
}

async function atualizarMensagem(session, embed, row = null) {
    let msg = null;
    const payload = {
        embeds: [embed],
        components: row ? [row] : []
    };

    try {
        if (session.lastInteraction && typeof session.lastInteraction.editReply === 'function') {
            msg = await session.lastInteraction.editReply(payload).catch(() => null);
        }
    } catch (err) {
        console.error('Erro ao atualizar mensagem via sessionManager:', err);
    }

    if (msg) {
        salvarMensagemAtual(session, msg);
    }
    return msg;
}

function limparSessao(userId) {
    sessions.delete(userId);
}

async function iniciarCriacao(interaction) {
    const session = getSession(interaction.user.id);
    resetarFlagsTexto(session);
    
    session.waitingForName = true;
    session.data = {};

    const embed = new EmbedBuilder()
        .setTitle('Criação de Sistema de RPG')
        .setDescription('Para começarmos, digite aqui no chat o **nome oficial** que o seu sistema de RPG vai ter. Exemplo: "Crônicas de Arton", "Ordem Sobrevivência". Envie apenas o nome na sua próxima mensagem!')
        .setColor(0x00AE86);

    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    const reply = await interaction.fetchReply();
    
    session.lastMessageId = reply.id;
    session.lastInteraction = interaction;
    
    return reply;
}

module.exports = {
    getSession,
    setSession,
    resetarFlagsTexto,
    salvarMensagemAtual,
    atualizarMensagem,
    limparSessao,
    iniciarCriacao
};