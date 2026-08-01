const etapaConfigSelect = require('./etapaConfigSelect');
const etapaTipo = require('./etapaTipo');
const etapaXp = require('./etapaXp');
const etapaLootSelect = require('./etapaLootSelect');
const etapaLootArmas = require('./etapaLootArmas');
const etapaLootArmaduras = require('./etapaLootArmaduras');
const sessionCriarficha = require('./sessionCriarficha');
const etapaNome = require('./etapaNome');
const etapaRecursos = require('./etapaRecursos');
const etapaLootItens = require('./etapaLootItens');
const etapaLootDinheiro = require('./etapaLootDinheiro');
const etapaDescricao = require('./etapaDescricao');

async function handleInteractions(interaction) {
    if (await etapaConfigSelect.lidarComConfig(interaction)) return true;
    if (await etapaTipo.lidarComTipo(interaction)) return true;
    if (await etapaXp.lidarComXpBotoes(interaction)) return true;
    if (await etapaLootSelect.lidarComLootSimNao(interaction)) return true;
    if (await etapaLootSelect.lidarComLootTiposMenu(interaction)) return true;
    if (await etapaLootItens.lidarComItensSelect(interaction)) return true;
    if (await etapaLootArmas.lidarComArmasSelect(interaction)) return true;
    if (await etapaLootArmaduras.lidarComArmadurasSelect(interaction)) return true;
    if (await etapaLootArmas.lidarComArmasBotoes(interaction)) return true;
    if (await etapaLootArmaduras.lidarComArmadurasBotoes(interaction)) return true;
    return false;
}

async function handleMessages(message) {
    const session = sessionCriarficha.getSession(message.author.id);
    if (!session || !session.step) return false;

    if (session.step === 'AGUARDANDO_NOME') {
        await etapaNome.processarNome(message, session);
        return true;
    }
    if (session.step === 'AGUARDANDO_RECURSO_BASE' || session.step === 'AGUARDANDO_RECURSO_LIMITE') {
        await etapaRecursos.processarRecursosTexto(message, session);
        return true;
    }
    if (session.step === 'AGUARDANDO_XP_QTD') {
        await etapaXp.processarXpTexto(message, session);
        return true;
    }
    if (session.step === 'AGUARDANDO_ITENS_TEXTO_LIVRE' || session.step === 'AGUARDANDO_ITEM_CHANCE' || session.step === 'AGUARDANDO_ITEM_QTD') {
        await etapaLootItens.processarItensTexto(message, session);
        return true;
    }
    if (session.step?.startsWith('AGUARDANDO_ARMA_')) {
        await etapaLootArmas.processarArmaTexto(message, session);
        return true;
    }
    if (session.step?.startsWith('AGUARDANDO_ARMADURA_')) {
        await etapaLootArmaduras.processarArmaduraTexto(message, session);
        return true;
    }
    if (session.step === 'AGUARDANDO_DINHEIRO_TEXTO') {
        await etapaLootDinheiro.processarDinheiroTexto(message, session);
        return true;
    }
    if (session.step === 'AGUARDANDO_DESCRICAO_AI') {
        await etapaDescricao.processarDescricaoAi(message, session);
        return true;
    }

    return false;
}

module.exports = {
    iniciarCriacao: etapaConfigSelect.iniciarCriacao,
    handleInteractions,
    handleMessages
};