const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fichaManager = require('./fichaManager');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function getSistemaConfig() {
    try {
        const activeDbPath = path.resolve('sistemaativo-database.sqlite');
        if (!fs.existsSync(activeDbPath)) return {};
        const activeDb = new Database(activeDbPath, { readonly: true });
        const row = activeDb.prepare('SELECT conteudo_json FROM sistema_ativo LIMIT 1').get();
        activeDb.close();
        if (row && row.conteudo_json) {
            return JSON.parse(row.conteudo_json);
        }
    } catch (err) {}
    return {};
}

function calcularAtributo(nomeAttr, valorStr, config) {
    const tipo = (config.tipoAtributos || config.tipoAtributo || 'numero').toLowerCase();
    const numVal = Number(valorStr) || 0;
    
    if (tipo.includes('bolinha') || tipo.includes('dot')) {
        return {
            valorFinal: numVal,
            modificador: numVal,
            textoExibicao: `${numVal} (${numVal})`,
            explicacao: `${numVal}`
        };
    } else if (tipo === 'numero' || tipo.includes('modificador') || tipo.includes('mod')) {
        const base = Number(config.atribBase !== undefined ? config.atribBase : 6);
        const passo = Number(config.atribPasso !== undefined ? config.atribPasso : 2);
        const diff = numVal - base;
        const mod = diff >= 0 ? Math.floor(diff / passo) : Math.ceil(diff / passo);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        return {
            valorFinal: numVal,
            modificador: mod,
            textoExibicao: `${numVal} (${modStr})`,
            explicacao: modStr
        };
    } else {
        return {
            valorFinal: numVal,
            modificador: numVal,
            textoExibicao: `${numVal}`,
            explicacao: ''
        };
    }
}

function formatarAtributosDinamicos(atributosObj, config) {
    if (!atributosObj || (typeof atributosObj === 'object' && Object.keys(atributosObj).length === 0)) {
        return null;
    }
    
    let categoriasMap = {};
    let atributosConfig = config.atributosConfig || [];
    
    const encontrarCategoriaConfig = (nomeAttr) => {
        const found = atributosConfig.find(ac => ac.nome && ac.nome.toLowerCase() === nomeAttr.toLowerCase());
        return found?.categoria || 'Fisicas';
    };

    if (Array.isArray(atributosObj)) {
        for (const item of atributosObj) {
            const nome = item.nome || item.name || 'Atributo';
            const cat = item.categoria || item.cat || encontrarCategoriaConfig(nome);
            const valor = item.valor !== undefined ? item.valor : (item.valorFixo !== undefined ? item.valorFixo : 0);
            if (!categoriasMap[cat]) categoriasMap[cat] = [];
            categoriasMap[cat].push({ nome, valor });
        }
    } else {
        let isCategorizado = Object.values(atributosObj).some(v => v && typeof v === 'object' && !Array.isArray(v));
        if (isCategorizado) {
            for (const [cat, itens] of Object.entries(atributosObj)) {
                categoriasMap[cat] = [];
                for (const [nome, valor] of Object.entries(itens)) {
                    categoriasMap[cat].push({ nome, valor: typeof valor === 'object' ? (valor.valor !== undefined ? valor.valor : valor) : valor });
                }
            }
        } else {
            for (const [nome, valor] of Object.entries(atributosObj)) {
                const cat = encontrarCategoriaConfig(nome);
                if (!categoriasMap[cat]) categoriasMap[cat] = [];
                categoriasMap[cat].push({ 
                    nome, 
                    valor: typeof valor === 'object' ? (valor.valor !== undefined ? valor.valor : (valor.valorFixo !== undefined ? valor.valorFixo : valor)) : valor 
                });
            }
        }
    }
    
    let linhas = [];
    for (const [cat, itens] of Object.entries(categoriasMap)) {
        if (cat !== 'Geral') {
            linhas.push(`-- ${cat} --`);
        }
        for (const item of itens) {
            const calc = calcularAtributo(item.nome, item.valor, config);
            linhas.push(`• **${item.nome}:** \`${calc.textoExibicao}\``);
        }
        linhas.push('');
    }
    
    return linhas.join('\n').trim();
}

function formatarPericiasDinamicas(periciasData, atributosValores, config, nivel = 1) {
    if (!periciasData) return null;
    
    let periciasArray = [];
    if (Array.isArray(periciasData)) {
        periciasArray = periciasData;
    } else if (typeof periciasData === 'object') {
        for (const [k, v] of Object.entries(periciasData)) {
            if (typeof v === 'object' && v !== null) {
                periciasArray.push({ nome: k, ...v });
            } else {
                periciasArray.push({ nome: k, valorFixo: v });
            }
        }
    }
    
    if (periciasArray.length === 0) return null;
    
    let graduacaoValor = 0;
    const temGrad = config.temGraduacaoPericia === true || 
                    config.graduacaoBase !== undefined || 
                    config.baseGraduacao !== undefined || 
                    config.graduacaoAumentaComNivel !== undefined ||
                    config.graduacaoPassoNiveis !== undefined ||
                    config.graduacaoFreqNiveis !== undefined;
    
    if (temGrad) {
        const base = Number(config.graduacaoBase !== undefined ? config.graduacaoBase : config.baseGraduacao) || 0;
        const aumentaComNivel = config.graduacaoAumentaComNivel === true || 
                                config.graduacaoPassoNiveis !== undefined || 
                                config.graduacaoFreqNiveis !== undefined || 
                                config.graduacaoFrequencia !== undefined;
        
        if (aumentaComNivel) {
            const passoNiveis = Number(config.graduacaoPassoNiveis || config.graduacaoFreqNiveis || config.graduacaoFrequencia || config.frequenciaGraduacao) || 0;
            let incremento = Number(config.graduacaoIncremento !== undefined ? config.graduacaoIncremento : (config.graduacaoAumento !== undefined ? config.graduacaoAumento : 1));
            if (isNaN(incremento) || incremento === 0) incremento = 1;
            
            if (passoNiveis > 0) {
                const aumentosAplicados = Math.floor((nivel - 1) / passoNiveis);
                graduacaoValor = base + (aumentosAplicados * incremento);
            } else {
                graduacaoValor = base;
            }
        } else {
            graduacaoValor = base !== 0 ? base : (Number(config.graduacaoValorFixo) || 0);
        }
    }
    
    let categoriasMap = {};
    for (const p of periciasArray) {
        const nome = p.nome || p.name || 'Perícia';
        const cat = p.categoria || 'Fisicas';
        if (!categoriasMap[cat]) categoriasMap[cat] = [];
        
        let total = 0;
        let partes = [];
        
        if (temGrad && graduacaoValor !== 0) {
            total += graduacaoValor;
            const gradStr = graduacaoValor >= 0 ? `+${graduacaoValor}` : `${graduacaoValor}`;
            partes.push(`${gradStr} (Graduação)`);
        }
        
        const fv = p.valorFixo !== undefined ? Number(p.valorFixo) : (p.valor !== undefined ? Number(p.valor) : 0);
        if (!isNaN(fv) && fv !== 0) {
            total += fv;
            partes.push(`${fv} (valor fixo)`);
        }
        
        let attrs = p.atributoBase || p.atributos || [];
        if (typeof attrs === 'string') attrs = [attrs];
        
        for (const attrName of attrs) {
            let attrVal = 0;
            if (Array.isArray(atributosValores)) {
                const found = atributosValores.find(a => a.nome.toLowerCase() === attrName.toLowerCase());
                attrVal = found ? (found.valor || 0) : 0;
            } else {
                attrVal = atributosValores[attrName] || 0;
            }

            const calcAttr = calcularAtributo(attrName, attrVal, config);
            const mod = calcAttr.modificador !== undefined ? calcAttr.modificador : calcAttr.valorFinal;
            total += mod;
            const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
            partes.push(`${modStr} (Mod. ${attrName})`);
        }
        
        if (partes.length === 0) {
            total = fv;
            partes.push(`${fv}`);
        }
        
        categoriasMap[cat].push({
            nome,
            total,
            explicacao: partes.join(' + ')
        });
    }
    
    let linhas = [];
    for (const [cat, itens] of Object.entries(categoriasMap)) {
        if (cat !== 'Geral') {
            linhas.push(`-- ${cat} --`);
        }
        for (const item of itens) {
            linhas.push(`• **${item.nome} :** \`${item.total} (${item.explicacao})\``);
        }
        linhas.push('');
    }
    
    return linhas.join('\n').trim();
}

function calcularCa(caData, atributosValores, config) {
    if (!caData) return null;
    if (typeof caData === 'string') {
        try {
            caData = JSON.parse(caData);
        } catch (e) {
            return { valor: caData, texto: `${caData} (valor fixo)` };
        }
    }
    
    if (typeof caData !== 'object') {
        return { valor: caData, texto: `${caData} (valor fixo)` };
    }
    
    const metodo = caData.metodo;
    let total = 0;
    let partes = [];
    
    const getAttrVal = (attrName) => {
        if (Array.isArray(atributosValores)) {
            const found = atributosValores.find(a => a.nome.toLowerCase() === attrName.toLowerCase());
            return found ? (found.valor || 0) : 0;
        }
        return atributosValores[attrName] || 0;
    };
    
    if (metodo === 'valor_fixo') {
        const vf = Number(caData.valorFixo) || 0;
        total = vf;
        partes.push(`${vf} (valor fixo)`);
    } else if (metodo === 'atributo') {
        const attrs = caData.atributosSelecionados || [];
        for (const attrName of attrs) {
            const attrVal = getAttrVal(attrName);
            const calc = calcularAtributo(attrName, attrVal, config);
            const mod = calc.modificador !== undefined ? calc.modificador : calc.valorFinal;
            total += mod;
            partes.push(`${mod} (Mod. ${attrName})`);
        }
    } else if (metodo === 'valor_fixo_atributo') {
        const vf = Number(caData.valorFixo) || 0;
        total += vf;
        partes.push(`${vf} (valor fixo)`);
        const attrs = caData.atributosSelecionados || [];
        for (const attrName of attrs) {
            const attrVal = getAttrVal(attrName);
            const calc = calcularAtributo(attrName, attrVal, config);
            const mod = calc.modificador !== undefined ? calc.modificador : calc.valorFinal;
            total += mod;
            partes.push(`${mod >= 0 ? '+' : ''}${mod} (Mod. ${attrName})`);
        }
    } else if (metodo === 'rolagem_dado') {
        const res = caData.dadoRolado?.resultado || 0;
        total = res;
        partes.push(`${res} (Dado ${caData.dadoRolado?.tipo || 'dado'})`);
    } else if (metodo === 'rolagem_dado_atributo') {
        const res = caData.dadoRolado?.resultado || 0;
        total += res;
        partes.push(`${res} (Dado ${caData.dadoRolado?.tipo || 'dado'})`);
        const attrs = caData.atributosSelecionados || [];
        for (const attrName of attrs) {
            const attrVal = getAttrVal(attrName);
            const calc = calcularAtributo(attrName, attrVal, config);
            const mod = calc.modificador !== undefined ? calc.modificador : calc.valorFinal;
            total += mod;
            partes.push(`${mod >= 0 ? '+' : ''}${mod} (Mod. ${attrName})`);
        }
    } else {
        const valDireto = caData.valor || caData.valorFixo || 0;
        return { valor: valDireto, texto: `${valDireto} (valor fixo)` };
    }
    
    return {
        valor: total,
        texto: `${total} (${partes.join(' + ')})`
    };
}

/**
 * Função para extrair e formatar o dinheiro do sistema e da ficha do personagem
 */
function formatarDinheiro(dadosFicha, config) {
    const dinheiroConfig = config.dinheiroConfig || config.dinheiro || '';
    if (!dinheiroConfig || typeof dinheiroConfig !== 'string') return null;

    // Extrai os nomes antes dos dois-pontos (ex: "To: teste, Tp: teste" -> ["To", "Tp"])
    const partes = dinheiroConfig.split(',');
    const moedasNomes = [];

    for (const parte of partes) {
        const sub = parte.trim().split(':')[0];
        if (sub) {
            moedasNomes.push(sub.trim());
        }
    }

    if (moedasNomes.length === 0) return null;

    // Pega o dinheiro salvo na ficha (se houver) ou assume 0
    const dinheiroFicha = dadosFicha.dinheiro || dadosFicha.inventarioEquipamentos?.dinheiro || {};

    const exibirPartes = moedasNomes.map(nome => {
        // Tenta buscar o valor correspondente (case-insensitive)
        let valor = 0;
        const chaveEncontrada = Object.keys(dinheiroFicha).find(k => k.toLowerCase() === nome.toLowerCase());
        if (chaveEncontrada !== undefined) {
            valor = Number(dinheiroFicha[chaveEncontrada]) || 0;
        } else if (typeof dinheiroFicha === 'number') {
            valor = dinheiroFicha;
        }

        return `${nome} : ${valor}`;
    });

    return exibirPartes.join('  |  ');
}

async function verFichaComando(interaction) {
    const usuarioOpcao = interaction.options?.getUser ? interaction.options.getUser('usuario') : null;
    const targetUser = usuarioOpcao || interaction.user;
    const userId = targetUser.id;
    const isSelf = userId === interaction.user.id;
    
    let fichas = [];
    try {
        fichas = fichaManager.db.prepare('SELECT * FROM fichas WHERE userId = ?').all(userId);
    } catch (e) {
        fichas = [];
    }

    if (!fichas || fichas.length === 0) {
        const mensagemErro = isSelf 
            ? '❌ Você não possui nenhuma ficha criada ou salva!' 
            : `❌ O usuário ${targetUser.username} não possui nenhuma ficha criada ou salva!`;
        return interaction.reply({ 
            content: mensagemErro, 
            flags: [64] 
        });
    }

    if (fichas.length === 1) {
        const embed = gerarEmbedFicha(fichas[0]);
        const selectOptions = fichas.map((f, i) => {
            let dados = {};
            try { dados = JSON.parse(f.dadosJson || '{}'); } catch(e){}
            const nome = dados.informacoesGerais?.nome || f.nomePersonagem || 'Personagem';
            const sistema = f.sistemaNome || 'Sistema Padrão';
            const avatar = dados.informacoesGerais?.avatar || f.avatarNome || 'Nenhum';

            return {
                label: nome.substring(0, 100),
                description: `${sistema} | ${avatar}`.substring(0, 100),
                value: String(i),
                default: true
            };
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ficha_ver_select')
            .setPlaceholder('Alternar ficha...')
            .addOptions(selectOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const replyMsg = await interaction.reply({ embeds: [embed], components: [row], flags: [64], fetchReply: true });
        configurarColetor(replyMsg, interaction, fichas, 0);
        return;
    }

    const renderMenuSelecao = () => {
        const listaTexto = fichas.map((f) => {
            let dados = {};
            try { dados = JSON.parse(f.dadosJson || '{}'); } catch(e){}
            const nome = dados.informacoesGerais?.nome || f.nomePersonagem || 'Personagem';
            const sistema = f.sistemaNome || 'Sistema Padrão';
            return `• **${nome}** | ${sistema}`;
        }).join('\n');

        const tituloSelecao = isSelf ? '📜 Seleção de Fichas' : `📜 Fichas de ${targetUser.username}`;
        const descSelecao = isSelf 
            ? `Selecione abaixo qual ficha você deseja visualizar de forma privada:\n\n${listaTexto}`
            : `Selecione abaixo qual ficha de **${targetUser.username}** você deseja visualizar:\n\n${listaTexto}`;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(tituloSelecao)
            .setDescription(descSelecao);

        const selectOptions = fichas.map((f, i) => {
            let dados = {};
            try { dados = JSON.parse(f.dadosJson || '{}'); } catch(e){}
            const nome = dados.informacoesGerais?.nome || f.nomePersonagem || 'Personagem';
            const sistema = f.sistemaNome || 'Sistema Padrão';
            const avatar = dados.informacoesGerais?.avatar || f.avatarNome || 'Nenhum';

            return {
                label: nome.substring(0, 100),
                description: `${sistema} | ${avatar}`.substring(0, 100),
                value: String(i)
            };
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ficha_ver_select')
            .setPlaceholder('Escolha uma ficha para visualizar...')
            .addOptions(selectOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return { embeds: [embed], components: [row] };
    };

    const replyMsg = await interaction.reply({ 
        ...renderMenuSelecao(), 
        flags: [64],
        fetchReply: true 
    });

    configurarColetorMenuSelecao(replyMsg, interaction, fichas);
}

function configurarColetorMenuSelecao(replyMsg, interaction, fichas) {
    const userId = interaction.user.id;
    const collector = replyMsg.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async i => {
        if (i.user.id !== userId) {
            return i.reply({ content: '❌ Você não pode interagir com este menu.', flags: [64] });
        }

        if (i.isStringSelectMenu() && i.customId === 'ficha_ver_select') {
            const indexEscolhido = parseInt(i.values[0], 10);
            const fichaEscolhida = fichas[indexEscolhido];
            const embed = gerarEmbedFicha(fichaEscolhida);

            const selectOptions = fichas.map((f, idx) => {
                let dados = {};
                try { dados = JSON.parse(f.dadosJson || '{}'); } catch(e){}
                const nome = dados.informacoesGerais?.nome || f.nomePersonagem || 'Personagem';
                const sistema = f.sistemaNome || 'Sistema Padrão';
                const avatar = dados.informacoesGerais?.avatar || f.avatarNome || 'Nenhum';

                return {
                    label: nome.substring(0, 100),
                    description: `${sistema} | ${avatar}`.substring(0, 100),
                    value: String(idx),
                    default: idx === indexEscolhido
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ficha_ver_select')
                .setPlaceholder('Alternar para outra ficha...')
                .addOptions(selectOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await i.update({ embeds: [embed], components: [row] });
            configurarColetor(replyMsg, interaction, fichas, indexEscolhido);
            collector.stop();
        }
    });

    collector.on('end', async () => {
        try { await interaction.editReply({ components: [] }).catch(() => {}); } catch (e) {}
    });
}

function configurarColetor(replyMsg, interaction, fichas, indexInicial) {
    const userId = interaction.user.id;
    let indexAtual = indexInicial;

    const collector = replyMsg.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async i => {
        if (i.user.id !== userId) {
            return i.reply({ content: '❌ Você não pode interagir com este menu.', flags: [64] });
        }

        if (i.isStringSelectMenu() && i.customId === 'ficha_ver_select') {
            indexAtual = parseInt(i.values[0], 10);
            const fichaAtual = fichas[indexAtual];
            const embed = gerarEmbedFicha(fichaAtual);

            const selectOptions = fichas.map((f, idx) => {
                let dados = {};
                try { dados = JSON.parse(f.dadosJson || '{}'); } catch(e){}
                const nome = dados.informacoesGerais?.nome || f.nomePersonagem || 'Personagem';
                const sistema = f.sistemaNome || 'Sistema Padrão';
                const avatar = dados.informacoesGerais?.avatar || f.avatarNome || 'Nenhum';

                return {
                    label: nome.substring(0, 100),
                    description: `${sistema} | ${avatar}`.substring(0, 100),
                    value: String(idx),
                    default: idx === indexAtual
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ficha_ver_select')
                .setPlaceholder('Alternar para outra ficha...')
                .addOptions(selectOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await i.update({ embeds: [embed], components: [row] });
        }
    });

    collector.on('end', async () => {
        try { await interaction.editReply({ components: [] }).catch(() => {}); } catch (e) {}
    });
}

function gerarEmbedFicha(registroBanco) {
    let dados = {};
    try {
        dados = JSON.parse(registroBanco.dadosJson || '{}');
    } catch (e) {
        dados = {};
    }

    const config = getSistemaConfig();
    const info = dados.informacoesGerais || {};
    const combate = dados.combate || {};
    const atributos = dados.atributos || {};
    const pericias = dados.pericias || {};
    const equipamentos = dados.inventarioEquipamentos || {};

    const nomePersonagem = info.nome || registroBanco.nomePersonagem || 'Personagem sem Nome';
    const nivel = Number(info.nivel || dados.nivelPersonagem || registroBanco.nivel || 1);

    const tipo = info.tipo || registroBanco.tipoPersonagem || 'Padrão';
    const avatar = info.avatar || registroBanco.avatarNome || 'Nenhum';
    const sistema = registroBanco.sistemaNome || 'Sistema Padrão';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📜 Ficha: ${nomePersonagem}`)
        .setDescription(`🎭 **Avatar:** \`${avatar}\`\n⭐ **Nível:** \`${nivel}\` | **Classe/Tipo:** \`${tipo}\`\n📚 **Sistema:** \`${sistema}\`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const pv = combate.pv;
    const temPv = pv && (pv.maximo !== undefined && pv.maximo !== null && pv.maximo !== '' && pv.maximo !== 0);
    if (temPv) {
        const pvAtual = pv.atual !== undefined ? pv.atual : 0;
        const pvMax = pv.maximo;
        const percPv = typeof pvMax === 'number' ? Math.max(0, Math.min(1, pvAtual / (pvMax || 1))) : 1;
        const cheiosPv = Math.round(percPv * 10);
        const barraPv = '🟩'.repeat(cheiosPv) + '⬛'.repeat(10 - cheiosPv);

        embed.addFields({ 
            name: '❤️ Pontos de Vida (PV)', 
            value: `${barraPv}\n\`${pvAtual} / ${pvMax}\``, 
            inline: true 
        });
    }

    const nomeCaConfig = config.caNome || config.nomeCa || config.defesaNome || 'Classe de Armadura (CA)';
    const caData = combate.ca;
    const caCalculado = calcularCa(caData, atributos, config);
    if (caCalculado && caCalculado.valor !== null && caCalculado.valor !== undefined) {
        embed.addFields({ 
            name: `🛡️ ${nomeCaConfig}`, 
            value: `🛡️ \`${caCalculado.texto}\``, 
            inline: true 
        });
    }

    const pm = combate.pm;
    const temPm = pm && (pm.maximo !== undefined && pm.maximo !== null && pm.maximo !== '' && pm.maximo !== 0);
    if (temPm) {
        const pmAtual = pm.atual !== undefined ? pm.atual : 0;
        const pmMax = pm.maximo;
        const percPm = typeof pmMax === 'number' ? Math.max(0, Math.min(1, pmAtual / (pmMax || 1))) : 1;
        const cheiosPm = Math.round(percPm * 10);
        const barraPm = '🟦'.repeat(cheiosPm) + '⬛'.repeat(10 - cheiosPm);

        embed.addFields({ 
            name: '✨ Pontos de Mana / Magia (PM)', 
            value: `${barraPm}\n\`${pmAtual} / ${pmMax}\``, 
            inline: true 
        });
    }

    if (temPv || caCalculado || temPm) {
        embed.addFields({ name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' });
    }

    // Adiciona a linha de Dinheiro formatada na ficha
    const textoDinheiro = formatarDinheiro(dados, config);
    if (textoDinheiro) {
        embed.addFields({ 
            name: '💰 Dinheiro', 
            value: `\`${textoDinheiro}\``, 
            inline: false 
        });
        embed.addFields({ name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' });
    }

    const textoAtributos = formatarAtributosDinamicos(atributos, config);
    const textoPericias = formatarPericiasDinamicas(pericias, atributos, config, nivel);

    let temCamposLadoALado = false;
    if (textoAtributos && textoPericias) {
        embed.addFields(
            { name: '📊 Atributos', value: textoAtributos, inline: true },
            { name: '🎯 Perícias', value: textoPericias, inline: true }
        );
        temCamposLadoALado = true;
    } else {
        if (textoAtributos) {
            embed.addFields({ name: '📊 Atributos', value: textoAtributos, inline: false });
        }
        if (textoPericias) {
            embed.addFields({ name: '🎯 Perícias', value: textoPericias, inline: false });
        }
    }

    let textoArma = null;
    if (equipamentos && equipamentos.arma && Object.keys(equipamentos.arma).length > 0) {
        const a = equipamentos.arma;
        const bonusStr = a.bonusDano ? (a.bonusDano >= 0 ? ` +${a.bonusDano}` : ` ${a.bonusDano}`) : '';
        textoArma = `⚔️ **${a.nome || 'Arma'}**`;
        if (a.dadoDano) textoArma += `\n• Dano: \`${a.dadoDano}${bonusStr}\``;
        if (a.descricao) textoArma += `\n• *${a.descricao}*`;
    }

    let textoArmadura = null;
    if (equipamentos && equipamentos.armadura && Object.keys(equipamentos.armadura).length > 0) {
        const arm = equipamentos.armadura;
        textoArmadura = `🛡️ **${arm.nome || 'Armadura'}**`;
        if (arm.bonusCa !== undefined) textoArmadura += `\n• Bônus CA: \`${arm.bonusCa}\``;
        if (arm.ehPesada) textoArmadura += ` *(Armadura Pesada)*`;
        if (arm.descricao) textoArmadura += `\n• *${arm.descricao}*`;
    }

    if (textoArma || textoArmadura) {
        embed.addFields({ name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' });
        if (textoArma) {
            embed.addFields({ name: '⚔️ Arma Equipada', value: textoArma, inline: false });
        }
        if (textoArmadura) {
            embed.addFields({ name: '🛡️ Armadura Equipada', value: textoArmadura, inline: false });
        }
    }

    embed.setFooter({ text: 'Gerenciador Avançado de Fichas de RPG' })
         .setTimestamp();

    return embed;
}

module.exports = {
    verFichaComando
};