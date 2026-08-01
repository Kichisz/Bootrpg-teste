const fichaManager = require('../fichaManager');
const fichaTipo = require('./fichaTipo');
const fichaAvatar = require('./fichaAvatar');
const fichaNome = require('./fichaNome');
const fichaNivel = require('./fichaNivel');
const fichaAtributos = require('./fichaAtributos');
const fichaPericias = require('./fichaPericias');
const fichaPv = require('./fichaPv');
const fichaPm = require('./fichaPm');
const fichaRecursos = require('./fichaRecursos');
const fichaCa = require('./fichaCa');
const fichaArma = require('./fichaArma');
const fichaArmadura = require('./fichaArmadura');

const sessoesCriacao = new Map();

async function iniciarCriacao(interaction) {
    const sistemaAtivo = fichaManager.getSistemaAtivo();
    if (!sistemaAtivo) {
        return interaction.reply({ 
            content: '❌ Nenhum sistema de RPG está ativo neste servidor no momento! Peça ao narrador para ativar um sistema.', 
            flags: [64] 
        });
    }

    // Criação pública (visível para todos no chat para o GM poder ajudar), editando a mensagem anterior a cada etapa
    sessoesCriacao.set(interaction.user.id, {
        userId: interaction.user.id,
        sistemaNome: sistemaAtivo.nomeSistema || 'Sistema Atual',
        sistemaConfig: sistemaAtivo,
        etapaAtual: 'tipo',
        data: {}
    });

    return fichaTipo.exibir(interaction);
}

async function tratarInteracaoEtapa(interaction, session) {
    switch (session.etapaAtual) {
        case 'tipo': return fichaTipo.tratar(interaction, session);
        case 'avatar': return fichaAvatar.tratar(interaction, session);
        case 'atributos': return fichaAtributos.tratar(interaction, session);
        case 'pericias': return fichaPericias.tratar(interaction, session);
        case 'pv': return fichaPv.tratar(interaction, session); 
        case 'arma_simnao': return fichaArma.tratarSimNao(interaction, session);
        case 'armadura_simnao': return fichaArmadura.tratarSimNao(interaction, session);
        case 'armadura_pesada_simnao': return fichaArmadura.tratarPesadaSimNao(interaction, session);
        default: return false;
    }
}

async function tratarTextoEtapa(message, session) {
    try { await message.delete(); } catch (e) {}

    switch (session.etapaAtual) {
        case 'nome': return fichaNome.processar(message, session);
        case 'nivel': return fichaNivel.processar(message, session);
        case 'atributos': return fichaAtributos.processar(message, session);
        case 'pericias': return fichaPericias.processar(message, session);
        case 'pv': return fichaPv.processar(message, session);
        case 'pm': return fichaPm.processar(message, session);
        case 'recursos': return fichaRecursos.processar(message, session);
        case 'ca': return fichaCa.processar(message, session);
        
        // Etapas da Arma
        case 'arma_nome': return fichaArma.processarNome(message, session);
        case 'arma_dado_valor': return fichaArma.processarDadoValor(message, session);
        case 'arma_bonus_valor': return fichaArma.processarBonusValor(message, session);
        case 'arma_desc': return fichaArma.processarDesc(message, session);
        
        // Etapas da Armadura
        case 'armadura_nome': return fichaArmadura.processarNome(message, session);
        case 'armadura_bonus_ca': return fichaArmadura.processarBonusCa(message, session);
        case 'armadura_pesada_valor': return fichaArmadura.processarPesadaValor(message, session);
        case 'armadura_desc': return fichaArmadura.processarDesc(message, session);
        
        default: return false;
    }
}

module.exports = {
    sessoesCriacao,
    iniciarCriacao,
    tratarInteracaoEtapa,
    tratarTextoEtapa
};