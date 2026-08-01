const Database = require('better-sqlite3');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { obterContextoAtivo } = require('./checkActiveContext');
const { getConfigTemp, setConfigTemp } = require('./salvaguardaStore');

/**
 * Busca os dados reais da ficha no banco de dados SQLite com base no contexto ou IDs.
 */
function buscarDadosReaisFicha(contextoOrUserId, guildId = null, avatarNome = null) {
    try {
        let userId = contextoOrUserId;
        let avatarAlvo = avatarNome;

        if (typeof contextoOrUserId === 'object' && contextoOrUserId !== null) {
            userId = contextoOrUserId.userId || contextoOrUserId.user?.id;
            avatarAlvo = avatarAlvo || contextoOrUserId.avatarNome || contextoOrUserId.avatar || contextoOrUserId.dadosFicha?.avatarNome;
        }

        if (!userId) return {};

        const dbPath = path.join(__dirname, 'database-fichas.sqlite');
        const db = new Database(dbPath, { readonly: true });
        
        let row;
        if (avatarAlvo) {
            row = db.prepare('SELECT dadosJson FROM fichas WHERE userId = ? AND LOWER(TRIM(avatarNome)) = LOWER(TRIM(?))').get(userId, avatarAlvo);
        } else {
            row = db.prepare('SELECT dadosJson FROM fichas WHERE userId = ? LIMIT 1').get(userId);
        }
        
        db.close();
        if (!row || !row.dadosJson) return {};

        return JSON.parse(row.dadosJson);
    } catch (error) {
        console.error('Erro em buscarDadosReaisFicha:', error);
        return {};
    }
}

/**
 * Retorna o valor de um atributo específico do personagem.
 */
function getAttributeValue(userIdOrContext, avatarNome, attributeName) {
    let userId = userIdOrContext;
    let attrName = avatarNome;
    let avatar = null;

    if (typeof userIdOrContext === 'object' && userIdOrContext !== null) {
        userId = userIdOrContext.userId || userIdOrContext.user?.id;
        avatar = userIdOrContext.avatarNome || userIdOrContext.avatar;
        attrName = attributeName;
    } else {
        avatar = avatarNome;
        attrName = attributeName;
    }

    const dados = buscarDadosReaisFicha(userId, null, avatar);
    const atributos = dados.atributos || [];
    
    if (Array.isArray(atributos)) {
        const attr = atributos.find(a => a && (a.nome || a.name) && String(a.nome || a.name).toLowerCase() === String(attrName).toLowerCase());
        if (attr) return Number(attr.valor ?? attr.value ?? 0) || 0;
    } else if (typeof atributos === 'object' && atributos !== null) {
        const chave = Object.keys(atributos).find(k => k.toLowerCase() === String(attrName).toLowerCase());
        if (chave) return Number(atributos[chave] ?? 0) || 0;
    }

    return 0;
}

/**
 * Extrai os atributos disponíveis na ficha ou configuração do sistema.
 */
function extrairAtributos(contexto, dadosFichaReais) {
    const atributosFicha = dadosFichaReais.atributos || contexto?.dadosFicha?.atributos || contexto?.atributos || {};
    let lista = [];
    
    if (Array.isArray(atributosFicha)) {
        for (const a of atributosFicha) {
            if (a && (a.nome || a.name)) lista.push(String(a.nome || a.name).trim());
        }
    } else if (typeof atributosFicha === 'object' && atributosFicha !== null) {
        for (const key of Object.keys(atributosFicha)) {
            lista.push(String(key).trim());
        }
    }
    if (lista.length > 0) return [...new Set(lista)];

    const sys = contexto.sistemaConfig || {};
    const attrs = sys.atributosLista || sys.atributos || sys.attributes || [];
    if (Array.isArray(attrs)) {
        for (const s of attrs) {
            if (typeof s === 'string') lista.push(s.trim());
            else if (s && (s.nome || s.name)) lista.push(String(s.nome || s.name).trim());
        }
    }
    return [...new Set(lista)];
}

/**
 * Apresenta o menu interativo para o usuário selecionar os atributos do salvaguarda.
 */
async function solicitarAtributo(interaction, subtipoChave) {
    if (interaction && !interaction.deferred && !interaction.replied) {
        try { await interaction.deferUpdate(); } catch (e) {}
    }

    const userId = interaction.user.id;
    const contexto = obterContextoAtivo(userId, interaction.guild?.id);
    const dadosFichaReais = buscarDadosReaisFicha(contexto);
    
    let atributos = extrairAtributos(contexto, dadosFichaReais);
    if (!atributos || atributos.length === 0) {
        atributos = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
    }

    const options = atributos.slice(0, 25).map(attr => ({
        label: String(attr).substring(0, 100),
        value: String(attr).substring(0, 100)
    }));

    const customIdMenu = `salv_attr_select_${subtipoChave}`;
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Atributos (Múltiplos)')
        .setDescription(`Para o subtipo **${subtipoChave}**, selecione **um ou mais atributos** para somar no salvaguarda:`);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customIdMenu)
        .setPlaceholder('Selecione os atributos...')
        .setMinValues(1)
        .setMaxValues(Math.min(options.length, 25))
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    try {
        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (e) {
        await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] }).catch(() => {});
    }

    try {
        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === customIdMenu,
            time: 300000
        });

        collector.on('collect', async i => {
            if (!i.deferred && !i.replied) {
                try { await i.deferUpdate(); } catch (e) {}
            }

            const atual = getConfigTemp(i.user.id, subtipoChave) || {};
            const atributosFicha = dadosFichaReais.atributos;

            let valoresAtributosObj = {};
            for (const selAttr of i.values) {
                let valorEncontrado = 0;
                if (Array.isArray(atributosFicha)) {
                    const found = atributosFicha.find(a => a && (a.nome || a.name) && String(a.nome || a.name).toLowerCase() === selAttr.toLowerCase());
                    if (found) {
                        valorEncontrado = Number(found.valor ?? found.value ?? 0) || 0;
                    }
                } else if (typeof atributosFicha === 'object' && atributosFicha !== null) {
                    const chave = Object.keys(atributosFicha).find(k => k.toLowerCase() === selAttr.toLowerCase());
                    if (chave !== undefined) {
                        const val = atributosFicha[chave];
                        valorEncontrado = typeof val === 'object' ? Number(val.valor ?? val.value ?? 0) || 0 : Number(val) || 0;
                    }
                }
                valoresAtributosObj[selAttr] = valorEncontrado !== 0 ? valorEncontrado : 2;
            }

            setConfigTemp(i.user.id, subtipoChave, { 
                ...atual,
                atributos: i.values,
                valoresAtributos: valoresAtributosObj,
                atributosColetados: true 
            });

            collector.stop();

            // Importação dinâmica para evitar dependência circular
            const { avancarProximoPasso } = require('./salvaguardaFlow');
            return avancarProximoPasso(i, subtipoChave);
        });
    } catch (err) {}
}

module.exports = { 
    getAttributeValue, 
    buscarDadosReaisFicha, 
    solicitarAtributo, 
    extrairAtributos 
};