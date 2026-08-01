const atributosHandler = require('./atributos');
const periciasHandler = require('./pericias');
const xpHandler = require('./xp');
const recursosHandler = require('./recursos');
const extrasHandler = require('./extras'); 
const dinheiroHandler = require('./dinheiro');
const sessionManager = require('./sessionManager');

async function routeSetup(interaction) {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return false;

    const session = sessionManager.getSession(interaction.user.id);
    if (session) {
        sessionManager.salvarMensagemAtual(session, interaction);
    }

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
    }

    try {
        if (typeof dinheiroHandler.tratarInteracao === 'function' && await dinheiroHandler.tratarInteracao(interaction)) return true;
        if (typeof atributosHandler.tratarInteracao === 'function' && await atributosHandler.tratarInteracao(interaction)) return true;
        if (typeof atributosHandler.tratarInteracaoSelects === 'function' && await atributosHandler.tratarInteracaoSelects(interaction)) return true;
        if (typeof periciasHandler.tratarInteracao === 'function' && await periciasHandler.tratarInteracao(interaction)) return true;
        if (typeof xpHandler.tratarInteracao === 'function' && await xpHandler.tratarInteracao(interaction)) return true;
        if (typeof recursosHandler.tratarInteracao === 'function' && await recursosHandler.tratarInteracao(interaction)) return true;
        if (typeof extrasHandler.tratarBotaoExtras === 'function' && await extrasHandler.tratarBotaoExtras(interaction, session)) return true;
    } catch (err) {
        console.error('Erro em routeSetup:', err);
    }

    return false;
}

async function routeMessageSetup(message) {
    const session = sessionManager.getSession(message.author.id);
    if (!session) return false;

    // Etapa do Nome -> Vai direto para o Dinheiro
    if (session.waitingForName) {
        const nomeSistema = message.content.trim();
        if (!nomeSistema) return false;

        session.data.nomeSistema = nomeSistema;
        session.waitingForName = false;

        const channel = message.channel; // Salva o canal antes de deletar
        try {
            await message.delete();
        } catch (e) {}

        if (typeof dinheiroHandler.iniciarDinheiro === 'function') {
            const channelOrInteraction = session.lastInteraction || channel;
            return await dinheiroHandler.iniciarDinheiro(channelOrInteraction, session);
        }
        return true;
    }

    // Etapas de texto do Dinheiro (Vários ou Único)
    if ((session.waitingForDinheiroVarios || session.waitingForDinheiroUnico) && typeof dinheiroHandler.processarDinheiroTexto === 'function') {
        await dinheiroHandler.processarDinheiroTexto(message, session);
        return true;
    }

    // 🏆 PRIORIDADE MÁXIMA: Se estiver esperando os elementos customizados, o extras.js intercepta e salva imediatamente
    if (session.waitingForElementosCustomizados && typeof extrasHandler.tratarTextoExtras === 'function') {
        await extrasHandler.tratarTextoExtras(message, session);
        return true;
    }

    if (session.waitingForAtribNomes && typeof atributosHandler.receberAtributosNomes === 'function') {
        await atributosHandler.receberAtributosNomes(message, session);
        return true;
    }
    if (session.waitingForAtribBase && typeof atributosHandler.receberAtribBase === 'function') {
        await atributosHandler.receberAtribBase(message, session);
        return true;
    }
    if (session.waitingForAtribPasso && typeof atributosHandler.receberAtribPasso === 'function') {
        await atributosHandler.receberAtribPasso(message, session);
        return true;
    }
    if (session.waitingForBolinhasMax && typeof atributosHandler.receberBolinhasMax === 'function') {
        await atributosHandler.receberBolinhasMax(message, session);
        return true;
    }
    if (session.waitingForEscalaMax && typeof atributosHandler.receberEscalaMax === 'function') {
        await atributosHandler.receberEscalaMax(message, session);
        return true;
    }
    if (session.waitingForAtribCatNomes && typeof atributosHandler.receberAtribCatNomes === 'function') {
        await atributosHandler.receberAtribCatNomes(message, session);
        return true;
    }
    if ((session.waitingForPericiasNome || session.waitingForPericiasLista || session.waitingForPericiasBolinhasMax || session.waitingForPericiasEscalaMax || session.waitingForGradValorFixo || session.waitingForGradBase || session.waitingForGradPassoNiveis || session.waitingForGradIncremento) && typeof periciasHandler.processarPericiasTexto === 'function') {
        await periciasHandler.processarPericiasTexto(message, session);
        return true;
    }
    if (session.waitingForPericiaCatNomes && typeof periciasHandler.receberPericiaCatNomes === 'function') {
        await periciasHandler.receberPericiaCatNomes(message, session);
        return true;
    }
    if ((session.waitingForXpLinear || session.waitingForXpExponencialManual || session.waitingForXpBaseMultiplicador || session.waitingForXpFatorMultiplicador || session.waitingForXpMaxNiveisMultiplicador || session.waitingForAtribNiveisFreq || session.waitingForAtribPontosQtd || session.waitingForPericiaNiveisFreq || session.waitingForPericiaPontosQtd || session.waitingForAmbosAtribNiveisFreq || session.waitingForAmbosAtribPontosQtd || session.waitingForAmbosPericiaNiveisFreq || session.waitingForAmbosPericiaPontosQtd) && typeof xpHandler.processarXpTexto === 'function') {
        await xpHandler.processarXpTexto(message, session);
        return true;
    }
    if ((session.waitingForPvNome || session.waitingForPmNome || session.waitingForCaNome || session.waitingForRecursosExtrasNomes || session.waitingForDadoUnico || session.waitingForDadoCombate || session.waitingForDadoPericia) && typeof recursosHandler.processarRecursosTexto === 'function') {
        await recursosHandler.processarRecursosTexto(message, session);
        return true;
    }

    return false;
}

module.exports = {
    routeSetup,
    routeMessageSetup
};