const db = require('../../../database');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const sessions = new Map();

function getSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, {
            userId: userId,
            step: 'AGUARDANDO_NOME',
            configName: '',
            systemId: null,
            data: {},
            hasAtributos: false,
            hasPericias: false,
            hasPv: false,
            hasPm: false,
            hasCa: false,
            pvNome: 'PV',
            pmNome: 'PM',
            recursosExtras: [],
            interactionRef: null // Referência da interação para edição privada
        });
    }
    return sessions.get(userId);
}

function clearSession(userId) {
    sessions.delete(userId);
}

function carregarSistemaAtivo(session, guildId) {
    const activeRow = db.prepare('SELECT systemId FROM guild_active_system WHERE guildId = ?').get(guildId);
    if (!activeRow) return false;

    session.systemId = activeRow.systemId;
    const sys = db.prepare('SELECT * FROM rpg_systems WHERE id = ?').get(session.systemId);
    if (!sys) return false;

    let configObj = {};
    try {
        configObj = JSON.parse(sys.config || '{}');
    } catch (e) {
        configObj = {};
    }

    const checkAtiva = (val) => {
        if (val === true || val === 'true' || val === 1 || val === 'sim') return true;
        return false;
    };

    session.hasAtributos = checkAtiva(configObj.temAtributos ?? configObj.atributos ?? configObj.attributes);
    session.hasPericias = checkAtiva(configObj.temPericias ?? configObj.pericias ?? configObj.skills);
    session.hasPv = checkAtiva(configObj.temPv ?? configObj.pv ?? configObj.vida);
    session.hasPm = checkAtiva(configObj.temPm ?? configObj.pm ?? configObj.mana);
    session.hasCa = checkAtiva(configObj.temCa ?? configObj.ca ?? configObj.defesa);

    session.pvNome = configObj.pvNome || configObj.pvName || configObj.vidaNome || 'PV';
    session.pmNome = configObj.pmNome || configObj.pmName || configObj.manaNome || 'PM';
    
    session.recursosExtras = configObj.recursosExtrasLista || configObj.recursosExtras || [];

    return true;
}

async function avancarProximoPasso(message, session) {
    const salvarConfigDb = require('./salvarConfigDb');
    let embed = new EmbedBuilder().setColor('#5865F2');

    if (session.step === 'AGUARDANDO_NOME') {
        if (session.hasAtributos) {
            session.step = 'ATRIB_MIN';
            embed.setTitle('🛠️ Configuração do Criador - Atributos (Mínimo)')
                 .setDescription(
                     'Os atributos representam as características brutas e essenciais do NPC ou Inimigo (como Força, Destreza, Constituição, Inteligência, etc.).\n\n' +
                     '**Como funciona:** Este valor define o limite inferior absoluto que qualquer atributo pode assumir na geração automática, impedindo valores abaixo do estipulado.\n\n' +
                     '> 📝 **Digite abaixo o número correspondente ao valor mínimo:**'
                 );
        } else if (session.hasPericias) {
            session.step = 'PERICIA_MIN';
            embed.setTitle('🛠️ Configuração do Criador - Perícias (Mínimo)')
                 .setDescription(
                     'As perícias definem o treinamento técnico, perícia prática e especializações do NPC em áreas específicas (como Furtividade, Arcana, Acrobacia).\n\n' +
                     '**Como funciona:** Estabelece a graduação ou bônus mínimo que uma perícia pode possuir ao ser gerada pelo sistema.\n\n' +
                     '> 📝 **Digite abaixo o valor mínimo para as perícias:**'
                 );
        } else if (session.hasPv) {
            session.step = 'PV_MIN';
            embed.setTitle(`🛠️ Configuração do Criador - ${session.pvNome} (Mínimo)`)
                 .setDescription(
                     `Controla a vitalidade, resistência e a capacidade de suporte a danos (${session.pvNome}) do NPC.\n\n` +
                     '**Como funciona:** Define o patamar mínimo de durabilidade que os personagens gerados por esta configuração possuirão.\n\n' +
                     `> 📝 **Digite abaixo o valor mínimo para ${session.pvNome}:**`
                 );
        } else if (session.hasPm) {
            session.step = 'PM_MIN';
            embed.setTitle(`🛠️ Configuração do Criador - ${session.pmNome} (Mínimo)`)
                 .setDescription(
                     `Gerencia o recurso de energia, mana ou suprimento (${session.pmNome}) usado para desencadear habilidades e poderes especiais.\n\n` +
                     '**Como funciona:** Estabelece o limite inferior de energia disponível para o personagem gerado.\n\n' +
                     `> 📝 **Digite abaixo o valor mínimo para ${session.pmNome}:**`
                 );
        } else if (session.hasCa) {
            session.step = 'CA_VALOR';
            embed.setTitle('🛠️ Configuração do Criador - CA (Classe de Armadura)')
                 .setDescription(
                     'A Classe de Armadura (CA) determina o nível de proteção do NPC e a dificuldade que os atacantes possuem para acertá-lo em combate.\n\n' +
                     '**Como funciona:** Define o valor padrão ou base de proteção defensiva para o personagem.\n\n' +
                     '> 📝 **Digite abaixo o valor da CA:**'
                 );
        } else {
            session.step = 'RECURSOS';
            embed.setTitle('🛠️ Configuração do Criador - Finalização')
                 .setDescription(
                     'Todas as etapas aplicáveis foram percorridas com base nos recursos ativos do seu sistema.\n\n' +
                     '**Como funciona:** Digite **"ok"** para salvar definitivamente esta configuração de parâmetros no banco de dados.\n\n' +
                     '> 📝 **Digite "ok" para salvar:**'
                 );
        }
    } else if (session.step === 'ATRIB_MIN') {
        session.step = 'ATRIB_MAX';
        embed.setTitle('🛠️ Configuração do Criador - Atributos (Máximo)')
             .setDescription(
                 'Agora defina o teto para os atributos do seu NPC.\n\n' +
                 '**Como funciona:** Este parâmetro limita o valor máximo que um atributo pode alcançar na ficha gerada, preservando o equilíbrio mecânico e evitando disparidades de poder.\n\n' +
                 '> 📝 **Digite abaixo o número correspondente ao valor máximo:**'
             );
    } else if (session.step === 'ATRIB_MAX') {
        if (session.hasPericias) {
            session.step = 'PERICIA_MIN';
            embed.setTitle('🛠️ Configuração do Criador - Perícias (Mínimo)')
                 .setDescription(
                     'Defina agora o **valor mínimo** de treinamento para as perícias do NPC.\n\n' +
                     '**Como funciona:** Garante que as perícias geradas iniciem com pelo menos este patamar de proficiência.\n\n' +
                     '> 📝 **Digite abaixo o valor mínimo:**'
                 );
        } else if (session.hasPv) {
            session.step = 'PV_MIN';
            embed.setTitle(`🛠️ Configuração do Criador - ${session.pvNome} (Mínimo)`)
                 .setDescription(
                     `Defina o **valor mínimo de ${session.pvNome}**.\n\n` +
                     '**Como funciona:** Assegura a resistência inicial mínima do NPC.\n\n' +
                     `> 📝 **Digite abaixo o valor mínimo de ${session.pvNome}:**`
                 );
        } else if (session.hasPm) {
            session.step = 'PM_MIN';
            embed.setTitle(`🛠️ Configuração do Criador - ${session.pmNome} (Mínimo)`)
                 .setDescription(
                     `Defina o **valor mínimo de ${session.pmNome}**.\n\n` +
                     '**Como funciona:** Assegura a reserva energética inicial mínima do NPC.\n\n' +
                     `> 📝 **Digite abaixo o valor mínimo de ${session.pmNome}:**`
                 );
        } else if (session.hasCa) {
            session.step = 'CA_VALOR';
            embed.setTitle('🛠️ Configuração do Criador - CA')
                 .setDescription(
                     'Defina o **valor padrão ou mínimo** para a Classe de Armadura (CA).\n\n' +
                     '**Como funciona:** Define o grau defensivo do personagem.\n\n' +
                     '> 📝 **Digite abaixo o valor da CA:**'
                 );
        } else {
            session.step = 'RECURSOS';
            embed.setTitle('🛠️ Configuração do Criador - Finalização')
                 .setDescription(
                     'Parâmetros numéricos principais configurados com sucesso.\n\n' +
                     '**Como funciona:** Digite **"ok"** para prosseguir com o salvamento da configuração.\n\n' +
                     '> 📝 **Digite "ok" para confirmar:**'
                 );
        }
    } else if (session.step === 'PERICIA_MIN') {
        session.step = 'PERICIA_MAX';
        embed.setTitle('🛠️ Configuração do Criador - Perícias (Máximo)')
             .setDescription(
                 'Defina o **valor máximo** que uma perícia pode alcançar na ficha gerada.\n\n' +
                 '**Como funciona:** Estabelece o teto de especialização técnica para evitar que perícias fiquem com bônus desproporcionais.\n\n' +
                 '> 📝 **Digite abaixo o valor máximo:**'
             );
    } else if (session.step === 'PERICIA_MAX') {
        if (session.hasPv) {
            session.step = 'PV_MIN';
            embed.setTitle(`🛠️ Configuração do Criador - ${session.pvNome} (Mínimo)`)
                 .setDescription(
                     `Defina o **valor mínimo de ${session.pvNome}**.\n\n` +
                     '**Como funciona:** Estabelece o piso de vitalidade do NPC.\n\n' +
                     `> 📝 **Digite abaixo o valor mínimo de ${session.pvNome}:**`
                 );
        } else if (session.hasPm) {
            session.step = 'PM_MIN';
            embed.setTitle(`🛠️ Configuração do Criador - ${session.pmNome} (Mínimo)`)
                 .setDescription(
                     `Defina o **valor mínimo de ${session.pmNome}**.\n\n` +
                     '**Como funciona:** Estabelece o piso de energia mágica/técnica do NPC.\n\n' +
                     `> 📝 **Digite abaixo o valor mínimo de ${session.pmNome}:**`
                 );
        } else if (session.hasCa) {
            session.step = 'CA_VALOR';
            embed.setTitle('🛠️ Configuração do Criador - CA')
                 .setDescription(
                     'Defina o **valor padrão ou mínimo** para a Classe de Armadura (CA).\n\n' +
                     '**Como funciona:** Define o grau defensivo básico do personagem.\n\n' +
                     '> 📝 **Digite abaixo o valor da CA:**'
                 );
        } else {
            session.step = 'RECURSOS';
            embed.setTitle('🛠️ Configuração do Criador - Finalização')
                 .setDescription(
                     'Configuração de perícias finalizada.\n\n' +
                     '**Como funciona:** Digite **"ok"** para salvar e concluir o processo.\n\n' +
                     '> 📝 **Digite "ok" para confirmar:**'
                 );
        }
    } else if (session.step === 'PV_MIN') {
        session.step = 'PV_MAX';
        embed.setTitle(`🛠️ Configuração do Criador - ${session.pvNome} (Máximo)`)
             .setDescription(
                 `Defina o **valor máximo** para ${session.pvNome}.\n\n` +
                 '**Como funciona:** Controla o teto de vitalidade máxima que os inimigos gerados podem ter.\n\n' +
                 `> 📝 **Digite abaixo o valor máximo de ${session.pvNome}:**`
             );
    } else if (session.step === 'PV_MAX') {
        if (session.hasPm) {
            session.step = 'PM_MIN';
            embed.setTitle(`🛠️ Configuração do Criador - ${session.pmNome} (Mínimo)`)
                 .setDescription(
                     `Defina o **valor mínimo** para ${session.pmNome}.\n\n` +
                     '**Como funciona:** Estabelece o limite inferior de recursos energéticos.\n\n' +
                     `> 📝 **Digite abaixo o valor mínimo de ${session.pmNome}:**`
                 );
        } else if (session.hasCa) {
            session.step = 'CA_VALOR';
            embed.setTitle('🛠️ Configuração do Criador - CA')
                 .setDescription(
                     'Defina o **valor padrão ou mínimo** para a Classe de Armadura (CA).\n\n' +
                     '**Como funciona:** Define o grau defensivo do personagem.\n\n' +
                     '> 📝 **Digite abaixo o valor da CA:**'
                 );
        } else {
            session.step = 'RECURSOS';
            embed.setTitle('🛠️ Configuração do Criador - Finalização')
                 .setDescription(
                     `Configuração de ${session.pvNome} concluída.\n\n` +
                     '**Como funciona:** Digite **"ok"** para salvar os dados no sistema.\n\n' +
                     '> 📝 **Digite "ok" para confirmar:**'
                 );
        }
    } else if (session.step === 'PM_MIN') {
        session.step = 'PM_MAX';
        embed.setTitle(`🛠️ Configuração do Criador - ${session.pmNome} (Máximo)`)
             .setDescription(
                 `Defina o **valor máximo** para ${session.pmNome}.\n\n` +
                 '**Como funciona:** Controla o limite superior de recursos ou habilidades especiais do NPC.\n\n' +
                 `> 📝 **Digite abaixo o valor máximo de ${session.pmNome}:**`
             );
    } else if (session.step === 'PM_MAX') {
        if (session.hasCa) {
            session.step = 'CA_VALOR';
            embed.setTitle('🛠️ Configuração do Criador - CA')
                 .setDescription(
                     'Defina o **valor padrão ou mínimo** para a Classe de Armadura (CA).\n\n' +
                     '**Como funciona:** Define o grau defensivo do personagem.\n\n' +
                     '> 📝 **Digite abaixo o valor da CA:**'
                 );
        } else {
            session.step = 'RECURSOS';
            embed.setTitle('🛠️ Configuração do Criador - Finalização')
                 .setDescription(
                     `Configuração de ${session.pmNome} concluída.\n\n` +
                     '**Como funciona:** Digite **"ok"** para salvar a configuração.\n\n' +
                     '> 📝 **Digite "ok" para confirmar:**'
                 );
        }
    } else if (session.step === 'CA_VALOR') {
        session.step = 'RECURSOS';
        embed.setTitle('🛠️ Configuração do Criador - Finalização')
             .setDescription(
                 'Todas as etapas obrigatórias e opcionais foram configuradas com sucesso!\n\n' +
                 '**Como funciona:** Digite **"ok"** para salvar permanentemente os parâmetros no banco de dados e concluir a criação da sua regra de NPCs.\n\n' +
                 '> 📝 **Digite "ok" para salvar:**'
             );
    } else if (session.step === 'RECURSOS') {
        return await salvarConfigDb.finalizar(message, session);
    }

    // Atualiza a resposta efêmera privada usando a interação original
    if (session.interactionRef) {
        try {
            await session.interactionRef.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Erro ao editar resposta efêmera:', err);
        }
    }
}

module.exports = {
    getSession,
    clearSession,
    carregarSistemaAtivo,
    avancarProximoPasso
};