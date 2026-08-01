const { EmbedBuilder } = require('discord.js');
const fichaManager = require('../fichaManager');

async function concluir(interaction, session) {
    return concluirGeral(interaction, session, true);
}

async function concluirNoChat(message, session) {
    return concluirGeral(message, session, false);
}

async function concluirGeral(context, session, isInteraction) {
    const raw = session.data || {};
    const config = session.sistemaConfig || {};
    
    const temCa = config.temCa === true;
    const temPv = config.temPv !== false;
    const temPm = config.temPm === true;

    // Organiza e consolida todos os dados mapeando as variáveis corretas de cada etapa
    const dadosEstruturados = {
        informacoesGerais: {
            nome: raw.nomePersonagem || 'Herói sem nome',
            nivel: raw.nivelPersonagem || raw.nivel || 1, // Corrigido aqui para ler nivelPersonagem
            tipo: raw.tipoPersonagem || 'Padrão',
            avatar: raw.avatarNome || 'Nenhum'
        },
        atributos: raw.atributosValores || raw.atributos || {},
        pericias: raw.periciasPersonagem || raw.periciasValoresFicha || raw.pericias || {},
        combate: {
            ca: temCa ? (raw.caValor || raw.caInfo || raw.ca || null) : null,
            pv: temPv ? {
                atual: raw.pvFinal || raw.pvMax || raw.pv || 0,
                maximo: raw.pvFinal || raw.pvMax || raw.pv || 0
            } : null,
            pm: temPm ? {
                atual: raw.pmValor || raw.pmMax || raw.pm || 0,
                maximo: raw.pmValor || raw.pmMax || raw.pm || 0
            } : null
        },
        recursos: raw.recursos || {},
        inventarioEquipamentos: {
            arma: raw.temArma ? {
                nome: raw.armaNome || 'Arma sem nome',
                dadoDano: raw.armaDadoValor || '1d6',
                bonusDano: raw.armaBonusValor || 0,
                descricao: raw.armaDesc || ''
            } : null,
            armadura: raw.temArmadura ? {
                nome: raw.armaduraNome || 'Armadura sem nome',
                bonusCa: raw.armaduraBonusCa || '+0',
                ehPesada: raw.ehArmaduraPesada || false,
                penalidadeStatus: raw.armaduraPenalidadeDestreza || 0,
                descricao: raw.armaduraDesc || ''
            } : null
        }
    };

    // Salva o objeto detalhado e estruturado no banco de dados
    try {
        fichaManager.salvarFichaNoBanco(
            session.userId,
            raw.avatarNome || 'Personagem',
            session.sistemaNome,
            raw.tipoPersonagem || 'Padrão',
            raw.nomePersonagem || 'Sem Nome',
            dadosEstruturados
        );
    } catch (e) {
        console.error('Erro ao salvar ficha estruturada no banco:', e);
    }

    try {
        const fichaCriarIndex = require('./fichaCriarIndex');
        if (fichaCriarIndex && fichaCriarIndex.sessoesCriacao) {
            fichaCriarIndex.sessoesCriacao.delete(session.userId);
        }
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 Ficha Criada com Sucesso!')
        .setDescription(`A ficha de **${dadosEstruturados.informacoesGerais.nome}** foi criada e estruturada com sucesso no sistema **${session.sistemaNome}**!`);

    const payload = { embeds: [embed], components: [] };

    if (isInteraction) {
        try {
            if (context.deferred || context.replied) {
                return await context.editReply(payload);
            } else if (typeof context.update === 'function') {
                return await context.update(payload);
            }
        } catch (e) {}
        return context.channel.send(payload);
    } else {
        const channel = context.channel || (context.message && context.message.channel);
        if (channel) {
            return await channel.send(payload);
        }
    }
}

module.exports = { 
    concluir, 
    concluirNoChat 
};