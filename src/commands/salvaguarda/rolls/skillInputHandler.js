const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { obterContextoAtivo } = require('./checkActiveContext');
const { getConfigTemp, setConfigTemp } = require('./salvaguardaStore');
const { avancarProximoPasso } = require('./salvaguardaFlow');
const { buscarDadosReaisFicha } = require('./attributeInputHandler');

function extrairPericias(contexto, dadosFichaReais) {
    const periciasFicha = dadosFichaReais.pericias || contexto?.dadosFicha?.pericias || contexto?.pericias || {};
    let lista = [];
    
    if (Array.isArray(periciasFicha)) {
        for (const p of periciasFicha) {
            if (p && (p.nome || p.name)) lista.push(String(p.nome || p.name).trim());
        }
    } else if (typeof periciasFicha === 'object' && periciasFicha !== null) {
        for (const key of Object.keys(periciasFicha)) {
            lista.push(String(key).trim());
        }
    }
    if (lista.length > 0) return [...new Set(lista)];

    const sys = contexto.sistemaConfig || {};
    const skills = sys.periciasLista || sys.pericias || sys.skills || [];
    if (Array.isArray(skills)) {
        for (const s of skills) {
            if (typeof s === 'string') lista.push(s.trim());
            else if (s && (s.nome || s.name)) lista.push(String(s.nome || s.name).trim());
        }
    }
    return [...new Set(lista)];
}

async function solicitarPericia(interaction, subtipoChave) {
    if (interaction && !interaction.deferred && !interaction.replied) {
        try { await interaction.deferUpdate(); } catch (e) {}
    }

    const userId = interaction.user.id;
    const contexto = obterContextoAtivo(userId, interaction.guild?.id);
    const dadosFichaReais = buscarDadosReaisFicha(contexto);
    
    let pericias = extrairPericias(contexto, dadosFichaReais);
    if (!pericias || pericias.length === 0) {
        pericias = ['Atletismo', 'Acrobacia', 'Furtividade', 'Percepção', 'Persuasão', 'Investigação', 'Ocultismo'];
    }

    const options = pericias.slice(0, 25).map(per => ({
        label: String(per).substring(0, 100),
        value: String(per).substring(0, 100)
    }));

    const customIdMenu = `salv_skill_select_${subtipoChave}`;
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎯 Perícias (Múltiplas)')
        .setDescription(`Para o subtipo **${subtipoChave}**, selecione **uma ou mais perícias** para somar no salvaguarda:`);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customIdMenu)
        .setPlaceholder('Selecione as perícias...')
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
            const periciasFicha = dadosFichaReais.pericias;
            const atributosFicha = dadosFichaReais.atributos || [];

            let valoresPericiasObj = {};
            for (const selPer of i.values) {
                let valorEncontrado = 0;
                if (Array.isArray(periciasFicha)) {
                    const found = periciasFicha.find(p => p && (p.nome || p.name) && String(p.nome || p.name).toLowerCase() === selPer.toLowerCase());
                    if (found) {
                        let baseVal = Number(found.valorFixo ?? found.valor ?? found.value ?? 0) || 0;
                        // Soma atributo base se houver vínculo na ficha
                        if (found.atributoBase && Array.isArray(found.atributoBase)) {
                            for (const attrName of found.atributoBase) {
                                const attrObj = atributosFicha.find(a => a && (a.nome || a.name) && String(a.nome || a.name).toLowerCase() === String(attrName).toLowerCase());
                                if (attrObj) {
                                    baseVal += Number(attrObj.valor ?? attrObj.value ?? 0) || 0;
                                }
                            }
                        }
                        valorEncontrado = baseVal;
                    }
                } else if (typeof periciasFicha === 'object' && periciasFicha !== null) {
                    const chave = Object.keys(periciasFicha).find(k => k.toLowerCase() === selPer.toLowerCase());
                    if (chave !== undefined) {
                        const val = periciasFicha[chave];
                        valorEncontrado = typeof val === 'object' ? Number(val.valorFixo ?? val.valor ?? val.value ?? 0) || 0 : Number(val) || 0;
                    }
                }
                valoresPericiasObj[selPer] = valorEncontrado !== 0 ? valorEncontrado : 1;
            }

            setConfigTemp(i.user.id, subtipoChave, { 
                ...atual,
                pericias: i.values,
                valoresPericias: valoresPericiasObj,
                periciasColetadas: true 
            });

            collector.stop();
            return avancarProximoPasso(i, subtipoChave);
        });
    } catch (err) {}
}

module.exports = { solicitarPericia, extrairPericias };