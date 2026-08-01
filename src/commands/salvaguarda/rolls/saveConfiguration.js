const { EmbedBuilder } = require('discord.js');
const path = require('path');
const { getSalvaguardaDb, getSalvaguardaNpcsDb } = require('./dbConfig');
const { obterContextoAtivo } = require('./checkActiveContext');
const { getConfigTemp, limparConfigTemp } = require('./salvaguardaStore');

let fichaManager = null;
const possiveisCaminhos = [
    path.resolve(__dirname, '../../../fichaManager'),
    path.resolve(__dirname, '../../../../fichaManager'),
    path.resolve(__dirname, '../../fichaManager'),
    path.resolve(__dirname, '../../../../src/fichaManager')
];

for (const caminho of possiveisCaminhos) {
    try {
        fichaManager = require(caminho);
        break;
    } catch (e) {}
}

function encontrarValorNaEstrutura(fonte, nomeChave) {
    if (!fonte) return null;
    const chaveLower = nomeChave.toLowerCase();

    if (typeof fonte === 'object' && !Array.isArray(fonte)) {
        for (const [k, v] of Object.entries(fonte)) {
            if (k.toLowerCase() === chaveLower) {
                if (v !== null && typeof v === 'object') {
                    return v.valor !== undefined ? v.valor : (v.valorFixo !== undefined ? v.valorFixo : (v.value !== undefined ? v.value : v));
                }
                return v;
            }
        }
    }

    if (Array.isArray(fonte)) {
        for (const item of fonte) {
            if (item && typeof item === 'object') {
                const nomeItem = (item.nome || item.name || item.titulo || item.label || '').toLowerCase();
                if (nomeItem === chaveLower) {
                    return item.valor !== undefined ? item.valor : (item.valorFixo !== undefined ? item.valorFixo : (item.value !== undefined ? item.value : item));
                }
            }
        }
    }

    return null;
}

function obterAtributoReal(contexto, dadosFicha, nomeAttr) {
    const fontes = [
        contexto.fichaAtributos,
        contexto.atributosFicha,
        contexto.data?.atributos,
        contexto.dados?.atributos,
        contexto.ficha?.atributos,
        contexto.atributos,
        dadosFicha?.atributos,
        dadosFicha?.dados?.atributos,
        dadosFicha?.attributes,
        dadosFicha?.dados?.attributes,
        dadosFicha
    ];

    for (const fonte of fontes) {
        const val = encontrarValorNaEstrutura(fonte, nomeAttr);
        if (val !== null && val !== undefined && val !== '') {
            const num = Number(val);
            if (!isNaN(num)) return num;
        }
    }
    return 0;
}

function obterPericiaReal(contexto, dadosFicha, nomePericia) {
    const fontes = [
        contexto.fichaPericias,
        contexto.periciasFicha,
        contexto.data?.pericias,
        contexto.dados?.pericias,
        contexto.ficha?.pericias,
        contexto.pericias,
        dadosFicha?.pericias,
        dadosFicha?.dados?.pericias,
        dadosFicha?.skills,
        dadosFicha?.dados?.skills,
        dadosFicha
    ];

    let valorPericiaDireto = 0;
    let objetoPericia = null;

    for (const fonte of fontes) {
        const val = encontrarValorNaEstrutura(fonte, nomePericia);
        if (val !== null && val !== undefined && val !== '') {
            if (typeof val === 'object') {
                objetoPericia = val;
                const subVal = val.valor !== undefined ? val.valor : (val.valorFixo !== undefined ? val.valorFixo : (val.value !== undefined ? val.value : 0));
                valorPericiaDireto = Number(subVal) || 0;
            } else {
                const num = Number(val);
                if (!isNaN(num)) valorPericiaDireto = num;
            }
            break;
        }
    }

    let somaAtributosBase = 0;
    if (objetoPericia && typeof objetoPericia === 'object') {
        let attrs = objetoPericia.atributoBase || objetoPericia.atributos || objetoPericia.attrBase || [];
        if (typeof attrs === 'string') attrs = [attrs];
        for (const attrName of attrs) {
            somaAtributosBase += obterAtributoReal(contexto, dadosFicha, attrName);
        }
    }

    return valorPericiaDireto + somaAtributosBase;
}

async function salvarConfiguracaoFinal(interaction, subtipoChave, dadosConfigRecebidos = {}) {
    const tempConfig = getConfigTemp(interaction.user.id, subtipoChave);
    const dadosConfig = { ...tempConfig, ...dadosConfigRecebidos };

    // 🛡️ TRAVA DE SEGURANÇA: Se os dados estiverem vazios, não deixa sobrescrever com lixo
    if (!dadosConfig || Object.keys(dadosConfig).length === 0 || (!dadosConfig.modoDado && !dadosConfig.componentes)) {
        console.log('⚠️ [SALVAGUARDA] Tentativa de salvar dados vazios bloqueada com sucesso.');
        return;
    }

    if (dadosConfig.isNpc) {
        const dbNpcs = getSalvaguardaNpcsDb();
        const sistemaNome = dadosConfig.sistemaNome || 'Sistema Padrão';

        dbNpcs.prepare(`
            DELETE FROM salvaguardanpcs_configs 
            WHERE userId = ? AND sistemaNome = ? AND subtipoChave = ?
        `).run(interaction.user.id, sistemaNome, subtipoChave);

        dbNpcs.prepare(`
            INSERT INTO salvaguardanpcs_configs (guildId, userId, sistemaNome, subtipoChave, configJson)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            interaction.guild.id,
            interaction.user.id,
            sistemaNome,
            subtipoChave,
            JSON.stringify(dadosConfig)
        );
        
        dbNpcs.close();
    } else {
        const contexto = obterContextoAtivo(interaction.user.id, interaction.guild.id);
        if (contexto.erro) return;

        const db = getSalvaguardaDb();
        
        db.prepare(`
            DELETE FROM salvaguarda_configs 
            WHERE userId = ? AND sistemaNome = ? AND avatarNome = ? AND fichaId = ? AND subtipoChave = ?
        `).run(interaction.user.id, contexto.nomeSistema, contexto.avatarNome, contexto.fichaId, subtipoChave);

        db.prepare(`
            INSERT INTO salvaguarda_configs (guildId, userId, sistemaNome, avatarNome, fichaId, subtipoChave, configJson)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            interaction.guild.id,
            interaction.user.id,
            contexto.nomeSistema,
            contexto.avatarNome,
            contexto.fichaId,
            subtipoChave,
            JSON.stringify(dadosConfig)
        );
        
        db.close();
    }

    limparConfigTemp(interaction.user.id, subtipoChave);
}

module.exports = { salvarConfiguracaoFinal, obterAtributoReal, obterPericiaReal };