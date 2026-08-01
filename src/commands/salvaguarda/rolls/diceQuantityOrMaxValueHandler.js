const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getConfigTemp, setConfigTemp } = require('./salvaguardaStore');
const { obterContextoAtivo } = require('./checkActiveContext');
const { salvarConfiguracaoFinal } = require('./saveConfiguration');

// Funções de busca robusta idênticas às usadas no saveConfiguration.js
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
        contexto?.fichaAtributos,
        contexto?.atributosFicha,
        contexto?.data?.atributos,
        contexto?.dados?.atributos,
        contexto?.ficha?.atributos,
        contexto?.atributos,
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
        contexto?.fichaPericias,
        contexto?.periciasFicha,
        contexto?.data?.pericias,
        contexto?.dados?.pericias,
        contexto?.ficha?.pericias,
        contexto?.pericias,
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

async function perguntarModoDado(interaction, subtipoChave) {
    if (!interaction.deferred && !interaction.replied) {
        try { await interaction.deferUpdate(); } catch (e) {}
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📈 Modo do Dado de Desafio')
        .setDescription(
            'O número gerado pela soma dos atributos/perícias vai ser a **quantia de dados** ' +
            '(ex: se der 5, roda `5d10`), o **valor máximo no dado** (ex: se der 5, roda `1d5`) ' +
            'ou um **Bônus final** somado a um dado (ex: `1d20 + 5`)?'
        );

    const customIdMenu = `salv_dice_mode_${subtipoChave}`;
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customIdMenu)
        .setPlaceholder('Escolha o comportamento do dado...')
        .addOptions([
            { label: 'Quantia de dados (Ex: 5d10)', value: 'quantidade', description: 'A soma vira a quantidade de dados jogados.' },
            { label: 'Valor máximo no dado (Ex: 1d5)', value: 'maximo', description: 'A soma vira a face máxima do dado único.' },
            { label: 'Bônus final (Ex: 1d20 + 5)', value: 'bonus_final', description: 'A soma vira um bônus fixo somado a um dado.' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ embeds: [embed], components: [row] });

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

            const modoEscolhido = i.values[0];
            const atual = getConfigTemp(i.user.id, subtipoChave) || {};

            setConfigTemp(i.user.id, subtipoChave, { 
                ...atual,
                modoDado: modoEscolhido 
            });

            collector.stop();

            if (modoEscolhido === 'quantidade') {
                return perguntarFacesDado(i, subtipoChave);
            } else if (modoEscolhido === 'maximo') {
                return perguntarQuantidadeDadosFixos(i, subtipoChave);
            } else {
                return perguntarDadoBonusFinal(i, subtipoChave);
            }
        });
    } catch (err) {
        console.error("Erro no coletor do modo do dado:", err);
    }
}

async function perguntarFacesDado(interaction, subtipoChave) {
    if (!interaction.deferred && !interaction.replied) {
        try { await interaction.deferUpdate(); } catch (e) {}
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎲 Faces do Dado')
        .setDescription('Você escolheu que a soma define a **quantidade de dados**. Agora, escolha **quantas faces** esses dados terão:');

    const customIdMenu = `salv_dice_faces_${subtipoChave}`;
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customIdMenu)
        .setPlaceholder('Selecione o tipo de dado (faces)...')
        .addOptions([
            { label: 'D4 (4 faces)', value: '4' },
            { label: 'D6 (6 faces)', value: '6' },
            { label: 'D8 (8 faces)', value: '8' },
            { label: 'D10 (10 faces)', value: '10' },
            { label: 'D12 (12 faces)', value: '12' },
            { label: 'D20 (20 faces)', value: '20' },
            { label: 'D100 (100 faces)', value: '100' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ embeds: [embed], components: [row] });

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
            setConfigTemp(i.user.id, subtipoChave, { 
                ...atual,
                facesDado: i.values[0] 
            });

            collector.stop();
            return finalizarSalvaguarda(i, subtipoChave);
        });
    } catch (err) {
        console.error("Erro no coletor de faces do dado:", err);
    }
}

async function perguntarQuantidadeDadosFixos(interaction, subtipoChave) {
    if (!interaction.deferred && !interaction.replied) {
        try { await interaction.deferUpdate(); } catch (e) {}
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔢 Quantidade de Dados Fixos')
        .setDescription('Você escolheu que a soma define o **valor máximo (faces)** do dado. Agora, escolha **quantos dados** serão rolados com essa face máxima:');

    const customIdMenu = `salv_dice_qty_${subtipoChave}`;
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customIdMenu)
        .setPlaceholder('Selecione a quantidade de dados...')
        .addOptions([
            { label: '1 Dado (1dX)', value: '1' },
            { label: '2 Dados (2dX)', value: '2' },
            { label: '3 Dados (3dX)', value: '3' },
            { label: '4 Dados (4dX)', value: '4' },
            { label: '5 Dados (5dX)', value: '5' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ embeds: [embed], components: [row] });

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
            setConfigTemp(i.user.id, subtipoChave, { 
                ...atual,
                quantidadeFixaDados: i.values[0] 
            });

            collector.stop();
            return finalizarSalvaguarda(i, subtipoChave);
        });
    } catch (err) {
        console.error("Erro no coletor de quantidade fixa de dados:", err);
    }
}

async function perguntarDadoBonusFinal(interaction, subtipoChave) {
    if (!interaction.deferred && !interaction.replied) {
        try { await interaction.deferUpdate(); } catch (e) {}
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎲 Qual dado rodar?')
        .setDescription('Você escolheu o **Bônus final**. Agora, escolha **qual dado rodar para adicionar esse bônus**:');

    const customIdMenu = `salv_dice_bonus_${subtipoChave}`;
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customIdMenu)
        .setPlaceholder('Selecione o dado base...')
        .addOptions([
            { label: '1d4', value: '1d4' },
            { label: '1d6', value: '1d6' },
            { label: '1d8', value: '1d8' },
            { label: '1d10', value: '1d10' },
            { label: '1d12', value: '1d12' },
            { label: '1d20', value: '1d20' },
            { label: '1d100', value: '1d100' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ embeds: [embed], components: [row] });

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
            setConfigTemp(i.user.id, subtipoChave, { 
                ...atual,
                dadoBonus: i.values[0] 
            });

            collector.stop();
            return finalizarSalvaguarda(i, subtipoChave);
        });
    } catch (err) {
        console.error("Erro no coletor de dado do bônus final:", err);
    }
}

async function finalizarSalvaguarda(interaction, subtipoChave) {
    if (!interaction.deferred && !interaction.replied) {
        try { await interaction.deferUpdate(); } catch (e) {}
    }

    const configFinal = getConfigTemp(interaction.user.id, subtipoChave) || {};

    // 🛡️ TRAVA DE SEGURANÇA: Se o cache estiver vazio (execução duplicada), aborta para não sobrescrever o chat com lixo!
    if (!configFinal || Object.keys(configFinal).length === 0 || (!configFinal.modoDado && (!configFinal.atributos || configFinal.atributos.length === 0) && (!configFinal.pericias || configFinal.pericias.length === 0))) {
        return;
    }

    const atributosSelecionados = configFinal.atributos || [];
    const periciasSelecionadas = configFinal.pericias || [];
    let nomesComponentes = [...atributosSelecionados, ...periciasSelecionadas];
    const nomeComponentesStr = nomesComponentes.length > 0 ? nomesComponentes.join(' + ') : 'Atributos/Perícias';

    let formulaExemplo = '';
    let tipoDadoStr = '';
    let descricaoCalculo = '';

    if (configFinal.isNpc) {
        if (configFinal.modoDado === 'quantidade') {
            const faces = configFinal.facesDado || '10';
            tipoDadoStr = `d${faces}`;
            formulaExemplo = `[Atributos]d${faces}`;
        } else if (configFinal.modoDado === 'maximo') {
            const qty = configFinal.quantidadeFixaDados || '1';
            tipoDadoStr = `${qty}dX`;
            formulaExemplo = `${qty}d[Atributos]`;
        } else if (configFinal.modoDado === 'bonus_final') {
            const dadoBase = configFinal.dadoBonus || '1d20';
            tipoDadoStr = dadoBase;
            formulaExemplo = `${dadoBase} + [Atributos]`;
        }
        descricaoCalculo = `${nomeComponentesStr} = **${formulaExemplo}**`;
    } else {
        const contexto = obterContextoAtivo(interaction.user.id, interaction.guild.id);
        const dadosFicha = contexto.dadosFicha || {};

        let somaTotal = 0;
        let detalhesCalculo = [];

        for (const attr of atributosSelecionados) {
            const val = obterAtributoReal(contexto, dadosFicha, attr);
            somaTotal += val;
            detalhesCalculo.push(`${val} (${attr})`);
        }

        for (const per of periciasSelecionadas) {
            const val = obterPericiaReal(contexto, dadosFicha, per);
            somaTotal += val;
            detalhesCalculo.push(`${val} (${per})`);
        }

        if (somaTotal <= 0) {
            somaTotal = 1;
        }

        if (configFinal.modoDado === 'quantidade') {
            const faces = configFinal.facesDado || '10';
            tipoDadoStr = `d${faces}`;
            formulaExemplo = `${somaTotal}d${faces}`;
        } else if (configFinal.modoDado === 'maximo') {
            const qty = configFinal.quantidadeFixaDados || '1';
            tipoDadoStr = `${qty}dX`;
            formulaExemplo = `${qty}d${somaTotal}`;
        } else if (configFinal.modoDado === 'bonus_final') {
            const dadoBase = configFinal.dadoBonus || '1d20';
            tipoDadoStr = dadoBase;
            formulaExemplo = `${dadoBase} + ${somaTotal}`;
        }

        descricaoCalculo = `${detalhesCalculo.join(' + ')} = **${formulaExemplo}**`;
    }

    // Salva no banco de dados corretamente
    try {
        await salvarConfiguracaoFinal(interaction, subtipoChave, configFinal);
    } catch (e) {
        console.error("Erro ao salvar configuração final da salvaguarda:", e);
    }

    const embedFinal = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`✅ ${subtipoChave} configurado com sucesso!`)
        .setDescription(
            `O roll será:\n` +
            `**${nomeComponentesStr} (${tipoDadoStr})**\n\n` +
            descricaoCalculo
        );

    await interaction.editReply({ embeds: [embedFinal], components: [] });
}

module.exports = { perguntarModoDado };