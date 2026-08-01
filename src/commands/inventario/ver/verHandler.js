const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const inventarioConfig = require('../inventarioConfig');
const dbInventario = require('../database/dbInventario');

const ITENS_POR_PAGINA = 20;

function garantirColunasInventario(invDb) {
    try {
        invDb.prepare(`
            CREATE TABLE IF NOT EXISTS inventario_itens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fichaId TEXT,
                itemId TEXT,
                tipo TEXT,
                nome TEXT,
                quantia INTEGER,
                peso REAL,
                dadoDano TEXT,
                bonusDano TEXT,
                bonusCa TEXT,
                penalidadeDestreza TEXT,
                descricao TEXT,
                tipoArma TEXT,
                equipado INTEGER DEFAULT 0
            )
        `).run();
    } catch(e) {}
    
    const colunas = [
        'tipoArma TEXT', 'dadoDano TEXT', 'bonusDano TEXT', 'bonusCa TEXT', 
        'penalidadeDestreza TEXT', 'descricao TEXT', 'equipado INTEGER DEFAULT 0', 'itemId TEXT'
    ];
    for (const col of colunas) {
        try { invDb.prepare(`ALTER TABLE inventario_itens ADD COLUMN ${col}`).run(); } catch(e) {}
    }
}

function garantirTabelaEColunasChao(invDb) {
    try {
        invDb.prepare(`
            CREATE TABLE IF NOT EXISTS itens_chao (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fichaIdOrigem TEXT,
                nome TEXT,
                peso REAL,
                tipo TEXT,
                quantia INTEGER,
                dadoDano TEXT,
                bonusDano TEXT,
                bonusCa TEXT,
                penalidadeDestreza TEXT,
                descricao TEXT,
                tipoArma TEXT,
                em_uso_por TEXT,
                messageId TEXT,
                channelId TEXT,
                expiraEm INTEGER,
                pausaInicio INTEGER
            )
        `).run();
    } catch(e) {}
    try { invDb.prepare("ALTER TABLE itens_chao ADD COLUMN em_uso_por TEXT").run(); } catch(e) {}
    try { invDb.prepare("ALTER TABLE itens_chao ADD COLUMN messageId TEXT").run(); } catch(e) {}
    try { invDb.prepare("ALTER TABLE itens_chao ADD COLUMN channelId TEXT").run(); } catch(e) {}
    try { invDb.prepare("ALTER TABLE itens_chao ADD COLUMN expiraEm INTEGER").run(); } catch(e) {}
    try { invDb.prepare("ALTER TABLE itens_chao ADD COLUMN pausaInicio INTEGER").run(); } catch(e) {}
}

function formatarTempoRestante(totalSegundos) {
    const segundosTotais = Math.max(0, Math.floor(totalSegundos));
    const minutos = Math.floor(segundosTotais / 60);
    const segundos = segundosTotais % 60;

    if (minutos === 0) {
        return `${segundos} ${segundos === 1 ? 'segundo' : 'segundos'}`;
    }
    if (segundos === 0) {
        return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
    }
    return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} e ${segundos} ${segundos === 1 ? 'segundo' : 'segundos'}`;
}

// Intervalo global em background para gerenciar o timeout de 10s de uso e o tempo limite de 10 minutos no chão
if (!global.floorItemsIntervalStarted && typeof setInterval !== 'undefined') {
    global.floorItemsIntervalStarted = true;
    setInterval(async () => {
        try {
            const client = global.discordClient;
            if (!client) return;

            const invDb = dbInventario;
            garantirTabelaEColunasChao(invDb);
            const itens = invDb.prepare("SELECT * FROM itens_chao").all();
            const agora = Date.now();

            for (const item of itens) {
                // 1. Verificar timeout de 10s de uso (caso o usuário tenha fechado no X/ESC)
                if (item.em_uso_por) {
                    const partes = String(item.em_uso_por).split('_');
                    const timestampUso = parseInt(partes[1]) || 0;
                    if (timestampUso > 0 && (agora - timestampUso > 10000)) {
                        const tempoPausado = agora - (item.pausaInicio || timestampUso);
                        const novoExpira = (item.expiraEm || (agora + 600000)) + tempoPausado;

                        invDb.prepare('UPDATE itens_chao SET em_uso_por = NULL, pausaInicio = NULL, expiraEm = ? WHERE id = ?').run(novoExpira, item.id);

                        if (item.messageId && item.channelId) {
                            try {
                                const channel = await client.channels.fetch(item.channelId).catch(() => null);
                                if (channel) {
                                    const msg = await channel.messages.fetch(item.messageId).catch(() => null);
                                    if (msg) {
                                        const segundosRestantes = Math.max(1, Math.ceil((novoExpira - agora) / 1000));
                                        const embedRestaurado = criarEmbedItemChao(item, formatarTempoRestante(segundosRestantes), 'Disponível para recolher.');
                                        const rowPegar = new ActionRowBuilder().addComponents(
                                            new ButtonBuilder().setCustomId(`inv_pickup_${item.id}`).setLabel('✋ Pegar Item').setStyle(ButtonStyle.Success)
                                        );
                                        await msg.edit({
                                            content: null,
                                            embeds: [embedRestaurado],
                                            components: [rowPegar]
                                        }).catch(() => {});
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                } else if (item.expiraEm) {
                    // 2. Verificar se o timer expirou completamente
                    if (agora >= item.expiraEm) {
                        invDb.prepare('DELETE FROM itens_chao WHERE id = ?').run(item.id);
                        if (item.messageId && item.channelId) {
                            try {
                                const channel = await client.channels.fetch(item.channelId).catch(() => null);
                                if (channel) {
                                    const msg = await channel.messages.fetch(item.messageId).catch(() => null);
                                    if (msg) {
                                        const embedExpirado = new EmbedBuilder()
                                            .setTitle(`📦 Item no Chão: ${item.nome}`)
                                            .setColor(0xED4245)
                                            .setDescription(`❌ O tempo esgotou e o item desapareceu do chão.`);
                                        await msg.edit({ content: null, embeds: [embedExpirado], components: [] }).catch(() => {});
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                }
            }
        } catch (e) {}
    }, 3000);
}

function formatarNumeroBr(valor) {
    const num = Number(valor) || 0;
    return num.toFixed(1).replace('.', ',');
}

function truncarNome(nome, tamanhoMaximo = 16) {
    if (!nome) return 'Item'.padEnd(tamanhoMaximo, ' ');
    const limpo = String(nome).trim();
    let nomeTruncado = limpo.length <= tamanhoMaximo ? limpo : (limpo.substring(0, tamanhoMaximo - 3) + '...');
    
    const homoglyphs = {
        'A': 'А', 'B': 'В', 'C': 'С', 'E': 'Е', 'F': 'Ф', 'H': 'Н', 
        'K': 'К', 'M': 'М', 'O': 'О', 'P': 'Р', 'T': 'Т', 'X': 'Х', 'Y': 'У'
    };

    return nomeTruncado.split(' ').map(palavra => {
        if (palavra.length === 0) return palavra;
        const primeiraLetra = palavra.charAt(0);
        if (homoglyphs[primeiraLetra]) {
            return homoglyphs[primeiraLetra] + palavra.slice(1);
        }
        return palavra;
    }).join(' ').padEnd(tamanhoMaximo, ' ');
}

function formatarTipoItem(tipo) {
    let texto = 'Vazio';
    if (tipo === 'arma') texto = 'Arma';
    else if (tipo === 'armadura') texto = 'Armadura';
    else if (tipo === 'comum') texto = 'Item';
    
    const innerWidth = 10;
    const totalEspacos = innerWidth - texto.length;
    const espacosEsq = Math.floor(totalEspacos / 2);
    const espacosDir = totalEspacos - espacosEsq;
    return '[' + ' '.repeat(espacosEsq) + texto + ' '.repeat(espacosDir) + ']';
}

function formatarBonusBox(bonusDano) {
    const limpo = String(bonusDano || 'Nenhum').trim();
    let textoInterno = limpo.toLowerCase() === 'nenhum' ? '+Nenhum' : (limpo.startsWith('+') ? limpo : `+${limpo}`);
    const innerWidth = 10;
    if (textoInterno.length >= innerWidth) return `(${textoInterno.substring(0, innerWidth)})`;
    const totalEspacos = innerWidth - textoInterno.length;
    const espacosEsq = Math.floor(totalEspacos / 2);
    const espacosDir = totalEspacos - espacosEsq;
    return '(' + ' '.repeat(espacosEsq) + textoInterno + ' '.repeat(espacosDir) + ')';
}

function formatarDesvBox(penalidade) {
    let valorNum = 0;
    if (penalidade !== undefined && penalidade !== null) {
        const s = String(penalidade).trim().toLowerCase();
        if (s === 'sim' || s === 'true' || s === '1') valorNum = 1;
        else if (s !== 'não' && s !== 'nao' && s !== 'false' && s !== '0' && s !== 'nenhuma' && s !== '') {
            const parsed = parseInt(s.replace(/[^0-9\-]/g, ''));
            valorNum = isNaN(parsed) ? 0 : parsed;
        }
    }
    const textoInterno = `Desv: ${valorNum}`;
    const innerWidth = 10;
    if (textoInterno.length >= innerWidth) return `(${textoInterno.substring(0, innerWidth)})`;
    const totalEspacos = innerWidth - textoInterno.length;
    const espacosEsq = Math.floor(totalEspacos / 2);
    const espacosDir = totalEspacos - espacosEsq;
    return '(' + ' '.repeat(espacosEsq) + textoInterno + ' '.repeat(espacosDir) + ')';
}

function formatarTipoArmaDireita(tipoArma) {
    const limpo = String(tipoArma || 'Melee').trim();
    const targetWidth = 8;
    if (limpo.length >= targetWidth) return limpo.substring(0, targetWidth);
    return limpo.padStart(targetWidth, ' ');
}

function criarEmbedItemChao(item, tempoStr, acaoTexto = 'Disponível para recolher.') {
    const quantia = Number(item.quantia) || 1;
    const pesoTotal = Number(item.peso) || 0;
    const pesoUnitario = quantia > 0 ? pesoTotal / quantia : pesoTotal;

    const embed = new EmbedBuilder()
        .setTitle(`📦 Item no Chão: ${item.nome}`)
        .setColor(0xFEE75C)
        .setTimestamp();

    let desc = `Alguém jogou **${quantia}x ${item.nome}** no chão!\n\n`;
    desc += `⚖️ **Peso Total:** ${formatarNumeroBr(pesoTotal)}kg\n`;
    desc += `⚖️ **Peso Individual:** ${formatarNumeroBr(pesoUnitario)}kg\n`;

    if (item.tipo === 'arma') {
        const bonusDanoStr = item.bonusDano ? (String(item.bonusDano).startsWith('+') ? item.bonusDano : `+${item.bonusDano}`) : '+0';
        desc += `⚔️ **Tipo:** Arma (${item.tipoArma || 'Melee'})\n`;
        desc += `💥 **Dano:** ${item.dadoDano || '1d6'} | **Bônus:** ${bonusDanoStr}\n`;
    } else if (item.tipo === 'armadura') {
        const bonusCaStr = item.bonusCa ? (String(item.bonusCa).startsWith('+') ? item.bonusCa : `+${item.bonusCa}`) : '+0';
        let desvStr = 'Não';
        if (item.penalidadeDestreza !== undefined && item.penalidadeDestreza !== null) {
            const s = String(item.penalidadeDestreza).trim().toLowerCase();
            if (s === 'sim' || s === 'true' || s === '1' || s.includes('desv')) desvStr = 'Sim';
            else if (s !== 'não' && s !== 'nao' && s !== 'false' && s !== '0' && s !== 'nenhuma' && s !== '') desvStr = String(item.penalidadeDestreza);
        }
        desc += `🛡️ **Tipo:** Armadura\n`;
        desc += `🛡️ **CA:** ${bonusCaStr} | **Desv. Destreza:** ${desvStr}\n`;
    } else {
        desc += `📦 **Tipo:** Item Comum\n`;
    }

    if (item.descricao && String(item.descricao).trim() !== '') {
        desc += `📝 **Descrição:** ${item.descricao}\n`;
    }

    desc += `\n⏱️ **Tempo Restante:** ${tempoStr}\n`;
    desc += `📌 **Status:** ${acaoTexto}`;

    embed.setDescription(desc);
    return embed;
}

function getFichasDb(userId) {
    const rootDir = path.resolve('.');
    let arquivos = [];
    try { arquivos = fs.readdirSync(rootDir); } catch (e) {}
    const dbs = arquivos.filter(file => file.endsWith('.sqlite') || file.endsWith('.db'));
    const ignoredFiles = [
        'sistemaativo-database.sqlite', 'sistemainventarioconfig-database.sqlite',
        'pesoconfig-database.sqlite', 'inventarioplayers-database.sqlite',
        'Itenstabela-database.sqlite', 'Armastabela-database.sqlite', 'Armadurasstabela-database.sqlite'
    ];

    for (const file of dbs) {
        if (ignoredFiles.includes(file)) continue;
        try {
            const dbTest = new Database(path.resolve(rootDir, file), { readonly: true });
            const tableCheck = dbTest.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fichas'").get();
            if (tableCheck) {
                const userCheck = dbTest.prepare("SELECT 1 FROM fichas WHERE userId = ? OR id = ?").get(String(userId), userId);
                if (userCheck) { dbTest.close(); return new Database(path.resolve(rootDir, file), { readonly: true }); }
            }
            dbTest.close();
        } catch (e) {}
    }

    try { return new Database(path.resolve('fichas.sqlite'), { readonly: true }); } 
    catch (e) { return new Database(path.resolve('database.sqlite'), { readonly: true }); }
}

function obterFichaAtiva(userId) {
    const sistemaAtivoObj = inventarioConfig.getSistemaAtivo();
    const sistemaAtivoNome = sistemaAtivoObj?.nomeSistema || sistemaAtivoObj?.nome || sistemaAtivoObj?.sistema || null;

    let db;
    try {
        db = getFichasDb(userId);
        const fichas = db.prepare('SELECT * FROM fichas WHERE userId = ? OR id = ?').all(String(userId), userId);
        db.close();

        if (!fichas || fichas.length === 0) return null;

        if (sistemaAtivoNome) {
            const fichaSistema = fichas.find(f => f.sistemaNome && f.sistemaNome.toLowerCase().trim() === sistemaAtivoNome.toLowerCase().trim());
            if (fichaSistema) return fichaSistema;
        }
        return fichas[0];
    } catch (e) {
        if (db && db.open) db.close();
        return null;
    }
}

function obterTodasFichasDoServidor(senderUserId) {
    const rootDir = path.resolve('.');
    let arquivos = [];
    try { arquivos = fs.readdirSync(rootDir); } catch (e) {}
    const dbs = arquivos.filter(file => file.endsWith('.sqlite') || file.endsWith('.db'));
    const ignoredFiles = [
        'sistemaativo-database.sqlite', 'sistemainventarioconfig-database.sqlite',
        'pesoconfig-database.sqlite', 'inventarioplayers-database.sqlite',
        'Itenstabela-database.sqlite', 'Armastabela-database.sqlite', 'Armadurasstabela-database.sqlite'
    ];

    let todasFichas = [];
    for (const file of dbs) {
        if (ignoredFiles.includes(file)) continue;
        try {
            const dbTest = new Database(path.resolve(rootDir, file), { readonly: true });
            const tableCheck = dbTest.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fichas'").get();
            if (tableCheck) {
                const rows = dbTest.prepare("SELECT * FROM fichas").all();
                rows.forEach(r => {
                    if (String(r.userId) !== String(senderUserId)) {
                        todasFichas.push(r);
                    }
                });
            }
            dbTest.close();
        } catch (e) {}
    }
    return todasFichas;
}

function calcularPesoMaximo(sistemaNome, dadosFicha) {
    try {
        const pesoDb = new Database(path.resolve('pesoconfig-database.sqlite'), { readonly: true });
        const row = pesoDb.prepare('SELECT peso_json FROM peso_config WHERE sistema_nome = ?').get(sistemaNome);
        pesoDb.close();

        if (!row) return null;
        const pConfig = JSON.parse(row.peso_json || '{}');

        if (pConfig.tipoCalculo === 'valor_fixo') {
            return parseFloat(pConfig.valorFixo) || 0;
        } else if (pConfig.tipoCalculo === 'atrib_vezes_fixo' && pConfig.atributo) {
            const atributos = dadosFicha.atributos || dadosFicha.status || dadosFicha.attributes || {};
            const valorAtrib = Number(atributos[pConfig.atributo] || atributos[pConfig.atributo.toLowerCase()] || 10);
            return valorAtrib * (Number(pConfig.multiplicador) || 1);
        }
    } catch (e) {}
    return null;
}

function construirVisualInventario(itens, paginaDesejada, nomePersonagem, sistemaNome, avatarNome, pesoStr, userId) {
    const totalPaginas = Math.max(1, Math.ceil(itens.length / ITENS_POR_PAGINA));
    const paginaAtual = Math.max(1, Math.min(paginaDesejada, totalPaginas));
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const itensDaPagina = itens.slice(inicio, inicio + ITENS_POR_PAGINA);

    const armaEquipada = itens.find(i => i.tipo === 'arma' && Number(i.equipado) === 1);
    const armaduraEquipada = itens.find(i => i.tipo === 'armadura' && Number(i.equipado) === 1);

    let blocoEquipados = '🛡️ **EQUIPAMENTOS ATIVOS**\n';
    if (armaEquipada) {
        const bonusDanoStr = armaEquipada.bonusDano ? (String(armaEquipada.bonusDano).startsWith('+') ? armaEquipada.bonusDano : `+${armaEquipada.bonusDano}`) : '+0';
        blocoEquipados += `• **Arma:** ${armaEquipada.nome} [Dano: ${armaEquipada.dadoDano || '1d6'} | Bônus: ${bonusDanoStr} | Tipo: ${armaEquipada.tipoArma || 'Melee'}]\n`;
    } else {
        blocoEquipados += `• **Arma:** Punhos [Dano: 1d4 | Bônus: +0 | Tipo: Melee]\n`;
    }

    if (armaduraEquipada) {
        const caStr = armaduraEquipada.bonusCa ? (String(armaduraEquipada.bonusCa).startsWith('+') ? armaduraEquipada.bonusCa : `+${armaduraEquipada.bonusCa}`) : '+0';
        blocoEquipados += `• **Armadura:** ${armaduraEquipada.nome} [CA: ${caStr} | Desv. Destreza: ${armaduraEquipada.penalidadeDestreza ? 'Sim' : 'Não'}]\n`;
    } else {
        blocoEquipados += `• **Armadura:** Nenhuma [CA: +0 | Desv. Destreza: Não]\n`;
    }

    let linhas = [];
    for (let i = 0; i < ITENS_POR_PAGINA; i++) {
        const numeroSlot = String(inicio + i + 1).padStart(2, '0');
        const item = itensDaPagina[i];

        if (item) {
            const nomeFormatado = truncarNome(item.nome, 16);
            const pesoFmt = formatarNumeroBr(item.peso || 0).padStart(5, ' ');
            const tipoBox = formatarTipoItem(item.tipo);
            linhas.push(`[${numeroSlot}] ${nomeFormatado} │ ${tipoBox} │ ${pesoFmt}kg`);

            if (item.tipo === 'comum') {
                linhas.push(`      └── Quantia: ${item.quantia || 1}`.padEnd(22, ' ') + `│${' '.repeat(14)}│`);
            } else if (item.tipo === 'arma') {
                const bonusBox = formatarBonusBox(item.bonusDano);
                let tipoArmaFmt = item.tipoArma || item.subtipo || 'Melee';
                linhas.push(`      └── Dano: ${item.dadoDano || '1d6'}`.padEnd(22, ' ') + `│ ${bonusBox} │` + formatarTipoArmaDireita(tipoArmaFmt));
            } else if (item.tipo === 'armadura') {
                const desvBox = formatarDesvBox(item.penalidadeDestreza);
                linhas.push(`      └── CA: ${item.bonusCa || '+0'}`.padEnd(22, ' ') + `│ ${desvBox} │`);
            }
        } else {
            linhas.push(`[${numeroSlot}] ` + '-'.repeat(16) + ` │ ` + formatarTipoItem(null) + ` │ ${formatarNumeroBr(0).padStart(5, ' ')}kg`);
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`🎒 Inventário: ${nomePersonagem}`)
        .setDescription(`**Sistema:** ${sistemaNome}\n**Avatar:** ${avatarNome}\n**Peso Total:** ${pesoStr}\n\n${blocoEquipados}\n📦 **MOCHILA (Pág. ${paginaAtual}/${totalPaginas})**\n\`\`\`prolog\n${linhas.join('\n')}\n\`\`\``)
        .setColor(0x5865F2)
        .setTimestamp();

    const selectRow = new ActionRowBuilder();
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`inv_select_item_${paginaAtual}_${userId}`)
        .setMinValues(1)
        .setMaxValues(Math.min(itensDaPagina.filter(i => i).length || 1, 10))
        .setPlaceholder('📦 Selecione um ou mais itens para interagir...');

    const itensValidos = itensDaPagina.filter(i => i);
    if (itensValidos.length > 0) {
        itensValidos.forEach((item, idx) => {
            const slotReal = inicio + itensDaPagina.indexOf(item) + 1;
            selectMenu.addOptions({
                label: `[${String(slotReal).padStart(2, '0')}] ${item.nome}`.substring(0, 100),
                description: `Tipo: ${item.tipo} | Qtd: ${item.quantia || 1} | Peso: ${item.peso || 0}kg`.substring(0, 100),
                value: `item_${item.id || slotReal}`
            });
        });
    } else {
        selectMenu.addOptions({ label: 'Nenhum item nesta página', value: 'vazio', description: 'Esta página não possui itens.' });
        selectMenu.setDisabled(true);
    }
    selectRow.addComponents(selectMenu);

    const rowBotoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`inv_page_prev_${paginaAtual}_${userId}`).setLabel('◀️ Anterior').setStyle(ButtonStyle.Primary).setDisabled(paginaAtual <= 1),
        new ButtonBuilder().setCustomId(`inv_page_next_${paginaAtual}_${userId}`).setLabel('Próxima ▶️').setStyle(ButtonStyle.Primary).setDisabled(paginaAtual >= totalPaginas)
    );

    return { embed, components: [selectRow, rowBotoes] };
}

async function verHandler(interaction) {
    global.discordClient = interaction.client;
    const usuarioAlvo = interaction.options.getUser('usuario');
    const isOutroUsuario = Boolean(usuarioAlvo);

    if (isOutroUsuario) {
        const ehGM = interaction.member?.roles?.cache?.some(r => r.name.toLowerCase() === 'gm' || r.name.toLowerCase() === 'mestre') || interaction.member?.permissions?.has('Administrator');
        if (!ehGM) {
            if (!interaction.deferred && !interaction.replied) {
                return await interaction.reply({ content: '❌ Você precisa ter o cargo **GM** para visualizar o inventário de outra pessoa.', flags: MessageFlags.Ephemeral });
            }
            return await interaction.editReply({ content: '❌ Você precisa ter o cargo **GM** para visualizar o inventário de outra pessoa.' });
        }
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } else {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
    }

    const userId = usuarioAlvo ? usuarioAlvo.id : interaction.user.id;
    const sistemaAtivoObj = inventarioConfig.getSistemaAtivo();
    const sistemaAtivoNome = sistemaAtivoObj?.nomeSistema || sistemaAtivoObj?.nome || sistemaAtivoObj?.sistema || null;

    if (!sistemaAtivoNome) {
        const payload = { content: '❌ Não foi possível identificar o **sistema RPG ativo**.' };
        if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
        return interaction.reply({ ...payload, flags: isOutroUsuario ? MessageFlags.Ephemeral : 0 });
    }

    try {
        const fichaAlvo = obterFichaAtiva(userId);
        if (!fichaAlvo) {
            const payload = { content: `❌ O usuário não possui ficha cadastrada.` };
            if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
            return interaction.reply({ ...payload, flags: isOutroUsuario ? MessageFlags.Ephemeral : 0 });
        }

        let dadosFicha = {};
        try { dadosFicha = JSON.parse(fichaAlvo.dadosJson || '{}'); } catch (e) {}

        const nomePersonagem = dadosFicha.informacoesGerais?.nome || fichaAlvo.nomePersonagem || 'Personagem';

        let itensInventario = [];
        try {
            const invDb = dbInventario;
            garantirColunasInventario(invDb);
            const possiveisIds = [fichaAlvo.id, fichaAlvo.rowid, fichaAlvo.userId, userId].filter(Boolean).map(id => String(id));
            if (possiveisIds.length > 0) {
                const placeholders = possiveisIds.map(() => '?').join(',');
                itensInventario = invDb.prepare(`SELECT * FROM inventario_itens WHERE fichaId IN (${placeholders})`).all(...possiveisIds);
            }
        } catch (e) {}

        let configInventario = {};
        try {
            const cfgDb = new Database(path.resolve('sistemainventarioconfig-database.sqlite'), { readonly: true });
            const cfgRow = cfgDb.prepare('SELECT config_json FROM inventario_config WHERE sistema_nome = ?').get(fichaAlvo.sistemaNome || sistemaAtivoNome);
            cfgDb.close();
            if (cfgRow) configInventario = JSON.parse(cfgRow.config_json || '{}');
        } catch (e) {}

        let pesoTotalGeral = 0;
        itensInventario.forEach(item => { pesoTotalGeral += Number(item.peso) || 0; });

        let pesoStr = formatarNumeroBr(pesoTotalGeral) + 'kg';
        if (configInventario.pesoAtivo) {
            const pesoMaximo = calcularPesoMaximo(fichaAlvo.sistemaNome || sistemaAtivoNome, dadosFicha);
            if (pesoMaximo !== null) pesoStr = `${formatarNumeroBr(pesoTotalGeral)}/${formatarNumeroBr(pesoMaximo)}kg`;
        }

        const { embed, components } = construirVisualInventario(itensInventario, 1, nomePersonagem, fichaAlvo.sistemaNome || sistemaAtivoNome, fichaAlvo.avatarNome || 'Desconhecido', pesoStr, userId);
        return interaction.editReply({ embeds: [embed], components: components });
    } catch (error) {
        return interaction.editReply({ content: '❌ Ocorreu um erro ao carregar o inventário.' });
    }
}

async function handleInteractions(interaction) {
    global.discordClient = interaction.client;
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('inv_select_item_')) {
        const partesId = interaction.customId.split('_');
        const ownerUserId = partesId[4];
        if (ownerUserId && interaction.user.id !== ownerUserId) {
            return interaction.reply({ content: '❌ Esse não é seu inventário, pare de tentar mexer!', flags: MessageFlags.Ephemeral });
        }

        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
        
        const valores = interaction.values;
        if (valores.includes('vazio')) return interaction.editReply({ content: '❌ Página vazia.' });

        try {
            const invDb = dbInventario;
            garantirColunasInventario(invDb);
            const itensSelecionados = [];

            const fichaUser = obterFichaAtiva(interaction.user.id);
            if (!fichaUser) return interaction.editReply({ content: '❌ Você não possui ficha cadastrada.' });

            const possiveisIdsUser = [fichaUser.id, fichaUser.rowid, fichaUser.userId, interaction.user.id].filter(Boolean).map(id => String(id));
            const phUser = possiveisIdsUser.map(() => '?').join(',');
            const itensInv = invDb.prepare(`SELECT * FROM inventario_itens WHERE fichaId IN (${phUser})`).all(...possiveisIdsUser);

            for (const val of valores) {
                const identifier = val.replace('item_', '');
                let itemObj = itensInv.find(i => String(i.id) === identifier) || itensInv[parseInt(identifier) - 1];
                if (itemObj && !itensSelecionados.some(i => i.id === itemObj.id)) itensSelecionados.push(itemObj);
            }

            if (itensSelecionados.length === 0) return interaction.editReply({ content: '❌ Nenhum item válido encontrado.' });

            const idsCsv = itensSelecionados.map(i => i.id).join(',');
            const multiplos = itensSelecionados.length > 1;
            const unicoItem = itensSelecionados[0];
            const ehEquipavel = !multiplos && (unicoItem.tipo === 'arma' || unicoItem.tipo === 'armadura');

            const embedDetalhes = new EmbedBuilder()
                .setTitle(multiplos ? `📦 Gerenciar Itens Selecionados (${itensSelecionados.length})` : `📦 Gerenciar Item: ${unicoItem.nome}`)
                .setColor(0x5865F2);

            if (!multiplos) {
                embedDetalhes.addFields(
                    { name: 'Tipo', value: `${unicoItem.tipo || 'Comum'}`, inline: true },
                    { name: 'Peso Total', value: `${unicoItem.peso || 0} kg`, inline: true },
                    { name: 'Quantidade', value: `${unicoItem.quantia || 1}`, inline: true }
                );
                if (unicoItem.tipo === 'arma') {
                    embedDetalhes.addFields(
                        { name: 'Dado de Dano', value: `${unicoItem.dadoDano || '1d6'}`, inline: true },
                        { name: 'Bônus de Dano', value: `${unicoItem.bonusDano || '+0'}`, inline: true }
                    );
                } else if (unicoItem.tipo === 'armadura') {
                    embedDetalhes.addFields({ name: 'Bônus CA', value: `${unicoItem.bonusCa || '+0'}`, inline: true });
                }
            } else {
                const nomes = itensSelecionados.map(i => `• ${i.nome} (Qtd: ${i.quantia || 1})`).join('\n');
                embedDetalhes.setDescription(`**Itens na seleção:**\n${nomes}`);
            }

            const rowAcoesItem = new ActionRowBuilder();
            if (ehEquipavel) {
                rowAcoesItem.addComponents(
                    new ButtonBuilder().setCustomId(`inv_action_equip_${unicoItem.id}`).setLabel(unicoItem.equipado ? 'Desequipar' : 'Usar/Equipar').setStyle(unicoItem.equipado ? ButtonStyle.Danger : ButtonStyle.Success)
                );
            }
            rowAcoesItem.addComponents(
                new ButtonBuilder().setCustomId(`inv_action_give_${idsCsv}`).setLabel('Dar item').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`inv_action_drop_${idsCsv}`).setLabel('Jogar fora').setStyle(ButtonStyle.Secondary)
            );

            return interaction.editReply({ embeds: [embedDetalhes], components: [rowAcoesItem] });
        } catch (e) {
            return interaction.editReply({ content: '❌ Erro ao processar os itens.' });
        }
    }

    if (interaction.isButton() && interaction.customId.startsWith('inv_action_')) {
        const partes = interaction.customId.split('_');
        const acao = partes[2];
        const ids = partes.slice(3).join('_');

        if (acao === 'equip') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
            const invDb = dbInventario;
            garantirColunasInventario(invDb);
            const item = invDb.prepare('SELECT * FROM inventario_itens WHERE id = ?').get(ids);
            if (item) invDb.prepare('UPDATE inventario_itens SET equipado = ? WHERE id = ?').run(item.equipado ? 0 : 1, ids);
            return interaction.editReply({ content: `✅ Estado do equipamento atualizado!`, embeds: [], components: [] });
        } 
        else if (acao === 'drop') {
            const idsArray = ids.split(',').slice(0, 5);
            const invDb = dbInventario;
            garantirColunasInventario(invDb);
            
            const modal = new ModalBuilder().setCustomId(`inv_modal_drop_multi_${ids}`).setTitle('Jogar Itens no Chão');
            for (const id of idsArray) {
                const item = invDb.prepare('SELECT * FROM inventario_itens WHERE id = ?').get(id);
                if (item) {
                    const maxQtd = Number(item.quantia) || 1;
                    const inputQtd = new TextInputBuilder()
                        .setCustomId(`drop_qty_${item.id}`)
                        .setLabel(`Qtd de ${item.nome.substring(0, 20)} (Máx: ${maxQtd})`)
                        .setStyle(TextInputStyle.Short)
                        .setValue(String(maxQtd))
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(inputQtd));
                }
            }
            return interaction.showModal(modal);
        }
        else if (acao === 'give') {
            const idsArray = ids.split(',');
            if (idsArray.length === 1) {
                const invDb = dbInventario;
                garantirColunasInventario(invDb);
                const itemUnico = invDb.prepare('SELECT * FROM inventario_itens WHERE id = ?').get(idsArray[0]);

                if (itemUnico && Number(itemUnico.quantia) > 1) {
                    const modal = new ModalBuilder().setCustomId(`inv_modal_give_${idsArray[0]}`).setTitle('Dar Item');
                    const inputQtd = new TextInputBuilder().setCustomId('qtd_give').setLabel(`Quantas unidades quer dar? (Máx: ${itemUnico.quantia})`).setStyle(TextInputStyle.Short).setValue('1').setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(inputQtd));
                    return interaction.showModal(modal);
                }
            }

            return prosseguirSelecaoDestinatario(interaction, ids, null);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('inv_modal_give_')) {
        const itemId = interaction.customId.replace('inv_modal_give_', '');
        const qtdDesejada = parseInt(interaction.fields.getTextInputValue('qtd_give')) || 1;

        const invDb = dbInventario;
        garantirColunasInventario(invDb);
        const item = invDb.prepare('SELECT * FROM inventario_itens WHERE id = ?').get(itemId);

        if (!item) {
            if (!interaction.deferred && !interaction.replied) await interaction.reply({ content: '❌ Item não encontrado.', flags: MessageFlags.Ephemeral });
            else await interaction.editReply({ content: '❌ Item não encontrado.', embeds: [], components: [] });
            return;
        }

        const qtdMax = Number(item.quantia) || 1;
        const qtdParaDar = Math.min(Math.max(1, qtdDesejada), qtdMax);

        return prosseguirSelecaoDestinatario(interaction, itemId, qtdParaDar);
    }

    async function prosseguirSelecaoDestinatario(interaction, ids, quantiaEspecifica) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
        
        const sufixoQtd = quantiaEspecifica ? `_${quantiaEspecifica}` : '_1';
        const todasFichasOutros = obterTodasFichasDoServidor(interaction.user.id);

        const selectDestino = new StringSelectMenuBuilder()
            .setCustomId(`inv_give_target_${ids}${sufixoQtd}`)
            .setPlaceholder('👥 Selecione o personagem destino...');

        todasFichasOutros.forEach(f => {
            let d = {};
            try { d = JSON.parse(f.dadosJson || '{}'); } catch(e){}
            const nomeP = d.informacoesGerais?.nome || f.nomePersonagem || 'Personagem';
            selectDestino.addOptions({ 
                label: nomeP.substring(0, 100), 
                value: String(f.id || f.rowid || f.userId),
                description: `Dono ID: ${f.userId}`.substring(0, 100)
            });
        });

        if (selectDestino.options.length === 0) {
            return interaction.editReply({ content: '❌ Nenhum outro personagem disponível no servidor para receber o item.', components: [], embeds: [] });
        }

        return interaction.editReply({ content: 'Selecione para qual personagem deseja transferir o(s) item(ns):', components: [new ActionRowBuilder().addComponents(selectDestino)], embeds: [] });
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('inv_modal_drop_multi_')) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
        const ids = interaction.customId.replace('inv_modal_drop_multi_', '');
        const idsArray = ids.split(',');

        const invDb = dbInventario;
        garantirTabelaEColunasChao(invDb);

        const fichaUser = obterFichaAtiva(interaction.user.id);
        let dadosUser = {};
        try { dadosUser = JSON.parse(fichaUser?.dadosJson || '{}'); } catch(e){}
        const nomePersonagemRemetente = dadosUser.informacoesGerais?.nome || fichaUser?.nomePersonagem || interaction.user.username;

        let itensDropadosCount = 0;
        const agora = Date.now();
        const expiraEmDefault = agora + 600000; // 10 minutos

        for (const id of idsArray) {
            const item = invDb.prepare('SELECT * FROM inventario_itens WHERE id = ?').get(id);
            if (!item) continue;

            let qtdDesejada = 1;
            try {
                qtdDesejada = parseInt(interaction.fields.getTextInputValue(`drop_qty_${item.id}`)) || 1;
            } catch (e) {}

            const qtdAtual = Number(item.quantia) || 1;
            const qtdParaJogar = Math.min(Math.max(1, qtdDesejada), qtdAtual);
            const pesoUnitario = (Number(item.peso) || 0) / qtdAtual;
            const pesoParaJogar = pesoUnitario * qtdParaJogar;

            if (qtdParaJogar >= qtdAtual) {
                invDb.prepare('DELETE FROM inventario_itens WHERE id = ?').run(item.id);
            } else {
                invDb.prepare('UPDATE inventario_itens SET quantia = quantia - ?, peso = peso - ? WHERE id = ?').run(qtdParaJogar, pesoParaJogar, item.id);
            }

            const infoChao = invDb.prepare(`
                INSERT INTO itens_chao (fichaIdOrigem, nome, peso, tipo, quantia, dadoDano, bonusDano, bonusCa, penalidadeDestreza, descricao, tipoArma, expiraEm, channelId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                fichaUser?.id || interaction.user.id,
                item.nome,
                pesoParaJogar,
                item.tipo || 'comum',
                qtdParaJogar,
                item.dadoDano || null,
                item.bonusDano || null,
                item.bonusCa || null,
                item.penalidadeDestreza || null,
                item.descricao || null,
                item.tipoArma || null,
                expiraEmDefault,
                interaction.channel.id
            );

            const chaoId = infoChao.lastInsertRowid;

            const dadosItemChaoObj = {
                nome: item.nome,
                quantia: qtdParaJogar,
                peso: pesoParaJogar,
                tipo: item.tipo || 'comum',
                dadoDano: item.dadoDano,
                bonusDano: item.bonusDano,
                bonusCa: item.bonusCa,
                penalidadeDestreza: item.penalidadeDestreza,
                descricao: item.descricao,
                tipoArma: item.tipoArma
            };

            const embedChao = criarEmbedItemChao(dadosItemChaoObj, formatarTempoRestante(600), `Jogado por **${nomePersonagemRemetente}**`);

            const rowPegar = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`inv_pickup_${chaoId}`).setLabel('✋ Pegar Item').setStyle(ButtonStyle.Success)
            );

            const msgEnviada = await interaction.channel.send({
                content: null,
                embeds: [embedChao],
                components: [rowPegar]
            });

            invDb.prepare('UPDATE itens_chao SET messageId = ? WHERE id = ?').run(msgEnviada.id, chaoId);

            itensDropadosCount++;
        }

        return interaction.editReply({ content: `🗑️ ${itensDropadosCount} item(ns) jogado(s) no chão com sucesso!`, embeds: [], components: [] });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('inv_give_target_')) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
        const partesCustomId = interaction.customId.replace('inv_give_target_', '').split('_');
        const destinoFichaId = interaction.values[0];
        const ids = partesCustomId[0];
        const quantiaInformada = parseInt(partesCustomId[1]) || 1;

        const invDb = dbInventario;
        garantirColunasInventario(invDb);
        const idsArray = ids.split(',');
        let pesoTotalTransferencia = 0;
        let descItens = [];

        for (const id of idsArray) {
            const it = invDb.prepare('SELECT * FROM inventario_itens WHERE id = ?').get(id);
            if (it) {
                const qtdAtual = Number(it.quantia) || 1;
                const qtdMovimento = idsArray.length === 1 ? quantiaInformada : qtdAtual;
                const pesoUnitario = (Number(it.peso) || 0) / qtdAtual;
                const pesoParcial = pesoUnitario * qtdMovimento;

                pesoTotalTransferencia += pesoParcial;
                descItens.push(`${qtdMovimento}x ${it.nome}`);
            }
        }

        const sistemaAtivoObj = inventarioConfig.getSistemaAtivo();
        const sistemaAtivoNome = sistemaAtivoObj?.nomeSistema || sistemaAtivoObj?.nome || sistemaAtivoObj?.sistema || null;
        const todasFichasServidor = obterTodasFichasDoServidor('');
        const destFicha = todasFichasServidor.find(f => String(f.id || f.rowid || f.userId) === String(destinoFichaId));
        
        let nomeDest = 'Personagem';
        if (destFicha) {
            try {
                const d = JSON.parse(destFicha.dadosJson || '{}');
                nomeDest = d.informacoesGerais?.nome || destFicha.nomePersonagem;
            } catch(e){}

            let configInventarioDest = {};
            const sistemaDest = destFicha.sistemaNome || sistemaAtivoNome;
            try {
                const cfgDb = new Database(path.resolve('sistemainventarioconfig-database.sqlite'), { readonly: true });
                const cfgRow = cfgDb.prepare('SELECT config_json FROM inventario_config WHERE sistema_nome = ?').get(sistemaDest);
                cfgDb.close();
                if (cfgRow) configInventarioDest = JSON.parse(cfgRow.config_json || '{}');
            } catch (e) {}

            if (configInventarioDest.pesoAtivo) {
                let dadosFichaDest = {};
                try { dadosFichaDest = JSON.parse(destFicha.dadosJson || '{}'); } catch(e){}
                const pesoMaximoDest = calcularPesoMaximo(sistemaDest, dadosFichaDest);

                if (pesoMaximoDest !== null) {
                    let pesoAtualDest = 0;
                    try {
                        const invDbCheck = dbInventario;
                        garantirColunasInventario(invDbCheck);
                        const possiveisIdsDest = [destFicha.id, destFicha.rowid, destFicha.userId].filter(Boolean).map(id => String(id));
                        if (possiveisIdsDest.length > 0) {
                            const phDest = possiveisIdsDest.map(() => '?').join(',');
                            const itensDest = invDbCheck.prepare(`SELECT * FROM inventario_itens WHERE fichaId IN (${phDest})`).all(...possiveisIdsDest);
                            itensDest.forEach(it => { pesoAtualDest += Number(it.peso) || 0; });
                        }
                    } catch (e) {}

                    if ((pesoAtualDest + pesoTotalTransferencia) > pesoMaximoDest) {
                        return interaction.editReply({ 
                            content: `❌ **Transferência Bloqueada:** O peso total dos itens (${formatarNumeroBr(pesoTotalTransferencia)}kg) faria ${nomeDest} ultrapassar o limite de peso permitido (${formatarNumeroBr(pesoAtualDest + pesoTotalTransferencia)}/${formatarNumeroBr(pesoMaximoDest)}kg).`, 
                            components: [], 
                            embeds: [] 
                        });
                    }
                }
            }
        }

        const nomeItensStr = descItens.join(', ');
        const precisaDeConfirmacaoPeso = pesoTotalTransferencia > 1.0;

        const rowConf = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`inv_give_sim_${destinoFichaId}_${ids}_${quantiaInformada}_${precisaDeConfirmacaoPeso ? 1 : 0}`).setLabel('Sim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`inv_give_nao`).setLabel('Não').setStyle(ButtonStyle.Danger)
        );

        let textoMsg = `Deseja mesmo dar **${nomeItensStr}** para **${nomeDest}**?`;
        if (precisaDeConfirmacaoPeso) textoMsg += `\n⚠️ *Aviso: O peso total (${formatarNumeroBr(pesoTotalTransferencia)}kg) ultrapassa 1kg.*`;

        return interaction.editReply({ content: textoMsg, components: [rowConf], embeds: [] });
    }

    if (interaction.isButton() && (interaction.customId.startsWith('inv_give_sim_') || interaction.customId === 'inv_give_nao')) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
        if (interaction.customId === 'inv_give_nao') return interaction.editReply({ content: '❌ Operação de doação cancelada.', components: [], embeds: [] });

        const partes = interaction.customId.split('_');
        const destinoFichaId = partes[3];
        const ids = partes[4];
        const quantiaInformada = parseInt(partes[5]) || 1;
        const precisaDeConfirmacaoPeso = partes[6] === '1';

        const invDb = dbInventario;
        garantirColunasInventario(invDb);
        const idsArray = ids.split(',');

        if (precisaDeConfirmacaoPeso) {
            let descItens = [];
            for (const id of idsArray) {
                const it = invDb.prepare('SELECT * FROM inventario_itens WHERE id = ?').get(id);
                if (it) {
                    const qtdAtual = Number(it.quantia) || 1;
                    const qtdMovimento = idsArray.length === 1 ? quantiaInformada : qtdAtual;
                    descItens.push(`${qtdMovimento}x ${it.nome}`);
                }
            }

            const todasFichasServidor = obterTodasFichasDoServidor('');
            const destFicha = todasFichasServidor.find(f => String(f.id || f.rowid || f.userId) === String(destinoFichaId));

            if (destFicha && destFicha.userId) {
                const receptorUser = await interaction.client.users.fetch(destFicha.userId).catch(() => null);
                if (receptorUser) {
                    const rowRec = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`inv_accept_${ids}_${destinoFichaId}_${quantiaInformada}`).setLabel('Aceitar').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`inv_recusar`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
                    );
                    await receptorUser.send({ content: `📦 Alguém quer te dar **${descItens.join(', ')}**, deseja aceitar?`, components: [rowRec] }).catch(() => {});
                }
            }
            return interaction.editReply({ content: `✅ Solicitação enviada e aguardando confirmação do receptor (por passar de 1kg)!`, components: [], embeds: [] });
        } else {
            executarTransferenciaItens(invDb, idsArray, destinoFichaId, quantiaInformada);
            return interaction.editReply({ content: `✅ Item(ns) transferido(s) com sucesso!`, components: [], embeds: [] });
        }
    }

    if (interaction.isButton() && interaction.customId.startsWith('inv_accept_')) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
        const partes = interaction.customId.split('_');
        const ids = partes[2];
        const destinoFichaId = partes[3];
        const quantiaInformada = parseInt(partes[4]) || 1;

        const invDbCheck = dbInventario;
        garantirColunasInventario(invDbCheck);
        const idsArrayCheck = ids.split(',');
        let pesoTotalTransferencia = 0;
        for (const id of idsArrayCheck) {
            const it = invDbCheck.prepare('SELECT * FROM inventario_itens WHERE id = ?').get(id);
            if (it) {
                const qtdAtual = Number(it.quantia) || 1;
                const qtdMovimento = idsArrayCheck.length === 1 ? quantiaInformada : qtdAtual;
                const pesoUnitario = (Number(it.peso) || 0) / qtdAtual;
                pesoTotalTransferencia += pesoUnitario * qtdMovimento;
            }
        }

        const sistemaAtivoObj = inventarioConfig.getSistemaAtivo();
        const sistemaAtivoNome = sistemaAtivoObj?.nomeSistema || sistemaAtivoObj?.nome || sistemaAtivoObj?.sistema || null;
        const todasFichasServidor = obterTodasFichasDoServidor('');
        const destFicha = todasFichasServidor.find(f => String(f.id || f.rowid || f.userId) === String(destinoFichaId));

        if (destFicha) {
            let configInventarioDest = {};
            const sistemaDest = destFicha.sistemaNome || sistemaAtivoNome;
            try {
                const cfgDb = new Database(path.resolve('sistemainventarioconfig-database.sqlite'), { readonly: true });
                const cfgRow = cfgDb.prepare('SELECT config_json FROM inventario_config WHERE sistema_nome = ?').get(sistemaDest);
                cfgDb.close();
                if (cfgRow) configInventarioDest = JSON.parse(cfgRow.config_json || '{}');
            } catch (e) {}

            if (configInventarioDest.pesoAtivo) {
                let dadosFichaDest = {};
                try { dadosFichaDest = JSON.parse(destFicha.dadosJson || '{}'); } catch(e){}
                const pesoMaximoDest = calcularPesoMaximo(sistemaDest, dadosFichaDest);

                if (pesoMaximoDest !== null) {
                    let pesoAtualDest = 0;
                    try {
                        const invDbCheck2 = dbInventario;
                        garantirColunasInventario(invDbCheck2);
                        const possiveisIdsDest = [destFicha.id, destFicha.rowid, destFicha.userId].filter(Boolean).map(id => String(id));
                        if (possiveisIdsDest.length > 0) {
                            const phDest = possiveisIdsDest.map(() => '?').join(',');
                            const itensDest = invDbCheck2.prepare(`SELECT * FROM inventario_itens WHERE fichaId IN (${phDest})`).all(...possiveisIdsDest);
                            itensDest.forEach(it => { pesoAtualDest += Number(it.peso) || 0; });
                        }
                    } catch (e) {}

                    if ((pesoAtualDest + pesoTotalTransferencia) > pesoMaximoDest) {
                        return interaction.editReply({ 
                            content: `❌ **Ação Cancelada:** Você não pode aceitar este(s) item(ns) pois ultrapassaria o seu limite de peso (${formatarNumeroBr(pesoAtualDest + pesoTotalTransferencia)}/${formatarNumeroBr(pesoMaximoDest)}kg).`, 
                            components: [], 
                            embeds: [] 
                        });
                    }
                }
            }
        }

        const invDb = dbInventario;
        garantirColunasInventario(invDb);
        executarTransferenciaItens(invDb, idsArrayCheck, destinoFichaId, quantiaInformada);

        return interaction.editReply({ content: `🎉 Você aceitou e guardou o(s) item(ns) no seu inventário!`, components: [], embeds: [] });
    }

    if (interaction.isButton() && interaction.customId === 'inv_recusar') {
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
        return interaction.editReply({ content: `❌ Você recusou os itens. Eles continuam com o remetente.`, components: [], embeds: [] });
    }

    function executarTransferenciaItens(invDb, idsArray, destinoFichaId, quantiaInformada) {
        garantirColunasInventario(invDb);
        for (const id of idsArray) {
            const item = invDb.prepare('SELECT * FROM inventario_itens WHERE id = ?').get(id);
            if (!item) continue;

            const qtdAtual = Number(item.quantia) || 1;
            const qtdMovimento = idsArray.length === 1 ? Math.min(quantiaInformada, qtdAtual) : qtdAtual;
            const pesoTotalItem = Number(item.peso) || 0;
            const pesoUnitario = qtdAtual > 0 ? pesoTotalItem / qtdAtual : pesoTotalItem;
            const pesoMovimento = pesoUnitario * qtdMovimento;

            const existente = invDb.prepare(
                'SELECT * FROM inventario_itens WHERE fichaId = ? AND itemId IS ? AND nome = ?'
            ).get(destinoFichaId, item.itemId || null, item.nome);

            if (existente) {
                const novaQtdAlvo = (Number(existente.quantia) || 1) + qtdMovimento;
                const novoPesoAlvo = (Number(existente.peso) || 0) + pesoMovimento;
                invDb.prepare('UPDATE inventario_itens SET quantia = ?, peso = ? WHERE id = ?')
                    .run(novaQtdAlvo, novoPesoAlvo, existente.id);

                if (qtdMovimento >= qtdAtual) {
                    invDb.prepare('DELETE FROM inventario_itens WHERE id = ?').run(item.id);
                } else {
                    invDb.prepare('UPDATE inventario_itens SET quantia = quantia - ?, peso = peso - ? WHERE id = ?')
                        .run(qtdMovimento, pesoMovimento, item.id);
                }
            } else {
                if (qtdMovimento >= qtdAtual) {
                    invDb.prepare('UPDATE inventario_itens SET fichaId = ? WHERE id = ?').run(destinoFichaId, item.id);
                } else {
                    invDb.prepare('UPDATE inventario_itens SET quantia = quantia - ?, peso = peso - ? WHERE id = ?')
                        .run(qtdMovimento, pesoMovimento, item.id);

                    invDb.prepare(`
                        INSERT INTO inventario_itens (fichaId, itemId, tipo, nome, quantia, peso, dadoDano, bonusDano, bonusCa, penalidadeDestreza, descricao, tipoArma, equipado)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                    `).run(
                        destinoFichaId,
                        item.itemId || null,
                        item.tipo || 'comum',
                        item.nome || 'Item',
                        qtdMovimento,
                        pesoMovimento,
                        item.dadoDano || null,
                        item.bonusDano || null,
                        item.bonusCa || null,
                        item.penalidadeDestreza || null,
                        item.descricao || null,
                        item.tipoArma || null
                    );
                }
            }
        }
    }

    if (interaction.isButton() && interaction.customId.startsWith('inv_pickup_')) {
        const chaoId = interaction.customId.replace('inv_pickup_', '');
        
        const invDb = dbInventario;
        garantirTabelaEColunasChao(invDb);

        let itemChao = invDb.prepare('SELECT * FROM itens_chao WHERE id = ?').get(chaoId);

        if (!itemChao) {
            return interaction.reply({ content: '❌ Este item já foi recolhido ou não existe mais.', flags: MessageFlags.Ephemeral });
        }

        const agora = Date.now();

        // Verificar bloqueio / timeout de 10 segundos
        if (itemChao.em_uso_por) {
            const partesUso = String(itemChao.em_uso_por).split('_');
            const userIdUso = partesUso[0];
            const timestampUso = parseInt(partesUso[1]) || 0;

            if (timestampUso > 0 && (agora - timestampUso > 10000)) {
                const tempoPausado = agora - (itemChao.pausaInicio || timestampUso);
                const novoExpira = (itemChao.expiraEm || (agora + 600000)) + tempoPausado;
                invDb.prepare('UPDATE itens_chao SET em_uso_por = NULL, pausaInicio = NULL, expiraEm = ? WHERE id = ?').run(novoExpira, chaoId);
                itemChao = invDb.prepare('SELECT * FROM itens_chao WHERE id = ?').get(chaoId);
            } else if (userIdUso !== interaction.user.id) {
                const tempoRestante = Math.ceil((10000 - (agora - timestampUso)) / 1000);
                return interaction.reply({ content: `❌ Outro jogador está interagindo com este item no momento. Tente novamente em ${tempoRestante > 0 ? tempoRestante : 1}s.`, flags: MessageFlags.Ephemeral });
            }
        }

        // Marcar em uso e registrar pausaInicio
        const valorEmUso = `${interaction.user.id}_${agora}`;
        invDb.prepare('UPDATE itens_chao SET em_uso_por = ?, pausaInicio = ? WHERE id = ?').run(valorEmUso, agora, chaoId);

        // Obter nome da ficha da pessoa que clicou
        const fichaUserClick = obterFichaAtiva(interaction.user.id);
        let dadosUserClick = {};
        try { dadosUserClick = JSON.parse(fichaUserClick?.dadosJson || '{}'); } catch(e){}
        const nomePersonagemPegando = dadosUserClick.informacoesGerais?.nome || fichaUserClick?.nomePersonagem || interaction.user.username;

        // Atualizar mensagem informando quem está decidindo
        if (itemChao.messageId) {
            try {
                const msgOriginal = await interaction.channel.messages.fetch(itemChao.messageId).catch(() => null);
                if (msgOriginal) {
                    const embedAtualizado = criarEmbedItemChao(itemChao, 'Pausado', `⏳ **${nomePersonagemPegando}** está decidindo...`);
                    const rowDesabilitado = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`inv_pickup_${chaoId}`).setLabel('✋ Pegar Item').setStyle(ButtonStyle.Success).setDisabled(true)
                    );
                    await msgOriginal.edit({
                        content: null,
                        embeds: [embedAtualizado],
                        components: [rowDesabilitado]
                    }).catch(() => {});
                }
            } catch (e) {}
        }

        const modal = new ModalBuilder().setCustomId(`inv_modal_pickup_${chaoId}`).setTitle('Pegar Item do Chão');
        const inputQtd = new TextInputBuilder().setCustomId('qtd_pickup').setLabel(`Quantos quer pegar? (Máx: ${itemChao.quantia})`).setStyle(TextInputStyle.Short).setValue('1').setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(inputQtd));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('inv_modal_pickup_')) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
        const chaoId = interaction.customId.replace('inv_modal_pickup_', '');
        const qtdDesejada = parseInt(interaction.fields.getTextInputValue('qtd_pickup')) || 1;

        const invDb = dbInventario;
        garantirColunasInventario(invDb);
        const itemChao = invDb.prepare('SELECT * FROM itens_chao WHERE id = ?').get(chaoId);

        if (!itemChao) {
            return interaction.editReply({ content: '❌ Este item não está mais disponível no chão.' });
        }

        const qtdDisponivel = Number(itemChao.quantia) || 1;
        if (qtdDesejada > qtdDisponivel || qtdDesejada < 1) {
            // Devolver tempo pausado e restaurar mensagem original
            const tempoPausado = Date.now() - (itemChao.pausaInicio || Date.now());
            const novoExpira = (itemChao.expiraEm || (Date.now() + 600000)) + tempoPausado;
            invDb.prepare('UPDATE itens_chao SET em_uso_por = NULL, pausaInicio = NULL, expiraEm = ? WHERE id = ?').run(novoExpira, chaoId);

            if (itemChao.messageId) {
                try {
                    const msgOriginal = await interaction.channel.messages.fetch(itemChao.messageId).catch(() => null);
                    if (msgOriginal) {
                        const segundosRestantes = Math.max(1, Math.ceil((novoExpira - Date.now()) / 1000));
                        const embedRestaurado = criarEmbedItemChao(itemChao, formatarTempoRestante(segundosRestantes), 'Disponível para recolher.');
                        const rowPegar = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`inv_pickup_${chaoId}`).setLabel('✋ Pegar Item').setStyle(ButtonStyle.Success)
                        );
                        await msgOriginal.edit({
                            content: null,
                            embeds: [embedRestaurado],
                            components: [rowPegar]
                        }).catch(() => {});
                    }
                } catch (e) {}
            }

            return interaction.editReply({ content: `❌ Quantidade inválida! Há apenas **${qtdDisponivel}** unidades disponíveis no chão.` });
        }

        const pesoUnitario = (Number(itemChao.peso) || 0) / qtdDisponivel;
        const pesoDesejado = pesoUnitario * qtdDesejada;

        try {
            const fichaUser = obterFichaAtiva(interaction.user.id);
            let dadosF = {};
            try { dadosF = JSON.parse(fichaUser?.dadosJson || '{}'); } catch(e){}
            const nomePersonagem = dadosF.informacoesGerais?.nome || fichaUser?.nomePersonagem || interaction.user.username;

            const fichaId = String(fichaUser?.id || fichaUser?.rowid || fichaUser?.userId || interaction.user.id);

            const existente = invDb.prepare(`
                SELECT * FROM inventario_itens 
                WHERE fichaId = ? AND nome = ? AND tipo = ? 
                AND COALESCE(dadoDano, '') = COALESCE(?, '') 
                AND COALESCE(bonusDano, '') = COALESCE(?, '') 
                AND COALESCE(bonusCa, '') = COALESCE(?, '')
            `).get(
                fichaId, 
                itemChao.nome, 
                itemChao.tipo || 'comum',
                itemChao.dadoDano || '',
                itemChao.bonusDano || '',
                itemChao.bonusCa || ''
            );

            if (existente) {
                const novaQtdAlvo = (Number(existente.quantia) || 1) + qtdDesejada;
                const novoPesoAlvo = (Number(existente.peso) || 0) + pesoDesejado;
                invDb.prepare('UPDATE inventario_itens SET quantia = ?, peso = ? WHERE id = ?')
                    .run(novaQtdAlvo, novoPesoAlvo, existente.id);
            } else {
                invDb.prepare(`
                    INSERT INTO inventario_itens (fichaId, nome, peso, tipo, quantia, dadoDano, bonusDano, bonusCa, penalidadeDestreza, descricao, tipoArma, equipado)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                `).run(
                    fichaId,
                    itemChao.nome,
                    pesoDesejado,
                    itemChao.tipo || 'comum',
                    qtdDesejada,
                    itemChao.dadoDano || null,
                    itemChao.bonusDano || null,
                    itemChao.bonusCa || null,
                    itemChao.penalidadeDestreza || null,
                    itemChao.descricao || null,
                    itemChao.tipoArma || null
                );
            }

            const qtdRestante = qtdDisponivel - qtdDesejada;

            if (qtdRestante <= 0) {
                invDb.prepare('DELETE FROM itens_chao WHERE id = ?').run(chaoId);

                if (itemChao.messageId) {
                    try {
                        const msgOriginal = await interaction.channel.messages.fetch(itemChao.messageId).catch(() => null);
                        if (msgOriginal) {
                            const embedExpirado = new EmbedBuilder()
                                .setTitle(`📦 Item no Chão: ${itemChao.nome}`)
                                .setColor(0x57F287)
                                .setDescription(`✨ Todos os(as) itens "${itemChao.nome}(s)" foram completamente pegos! Não há mais nenhum(a) no chão.`);
                            
                            await msgOriginal.edit({ content: null, embeds: [embedExpirado], components: [] }).catch(() => {});
                        }
                    } catch (e) {}
                }
            } else {
                const pesoRestante = (Number(itemChao.peso) || 0) - pesoDesejado;
                const novoExpiraRestante = Date.now() + 600000;
                invDb.prepare('UPDATE itens_chao SET quantia = ?, peso = ?, expiraEm = ?, em_uso_por = NULL, pausaInicio = NULL WHERE id = ?').run(qtdRestante, pesoRestante, novoExpiraRestante, chaoId);

                if (itemChao.messageId) {
                    try {
                        const msgOriginal = await interaction.channel.messages.fetch(itemChao.messageId).catch(() => null);
                        if (msgOriginal) await msgOriginal.delete().catch(() => {});
                    } catch (e) {}
                }

                const dadosItemRestanteObj = {
                    nome: itemChao.nome,
                    quantia: qtdRestante,
                    peso: pesoRestante,
                    tipo: itemChao.tipo || 'comum',
                    dadoDano: itemChao.dadoDano,
                    bonusDano: itemChao.bonusDano,
                    bonusCa: itemChao.bonusCa,
                    penalidadeDestreza: itemChao.penalidadeDestreza,
                    descricao: itemChao.descricao,
                    tipoArma: itemChao.tipoArma
                };

                const embedChao = criarEmbedItemChao(dadosItemRestanteObj, formatarTempoRestante(600), `Recolhido parcialmente por **${nomePersonagem}**`);

                const rowNovo = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`inv_pickup_${chaoId}`).setLabel('✋ Pegar Item').setStyle(ButtonStyle.Success)
                );

                const novaMsgChao = await interaction.channel.send({
                    content: null,
                    embeds: [embedChao],
                    components: [rowNovo]
                }).catch(() => {});

                if (novaMsgChao) {
                    const invDbUpdate = dbInventario;
                    garantirTabelaEColunasChao(invDbUpdate);
                    invDbUpdate.prepare('UPDATE itens_chao SET messageId = ? WHERE id = ?').run(novaMsgChao.id, chaoId);
                }
            }

            return interaction.editReply({ content: `🎉 Você pegou **${qtdDesejada}x ${itemChao.nome}** do chão!` });
        } catch (e) {
            invDb.prepare('UPDATE itens_chao SET em_uso_por = NULL, pausaInicio = NULL WHERE id = ?').run(chaoId);
            return interaction.editReply({ content: `❌ Erro ao recolher o item: \`${e.message}\`` });
        }
    }

    if (!interaction.isButton() || !interaction.customId.startsWith('inv_page_')) return false;

    const partes = interaction.customId.split('_');
    const acao = partes[2];
    const paginaAtualClick = parseInt(partes[3]) || 1;
    const ownerUserId = partes[4];

    if (ownerUserId && interaction.user.id !== ownerUserId) {
        return interaction.reply({ content: '❌ Esse não é seu inventário, pare de tentar mexer!', flags: MessageFlags.Ephemeral });
    }

    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});

    const novaPagina = acao === 'next' ? paginaAtualClick + 1 : paginaAtualClick - 1;

    const embedOriginal = interaction.message.embeds[0];
    if (!embedOriginal) return true;

    const nomePersonagem = (embedOriginal.title || '').replace('🎒 Inventário: ', '');
    const sistemaAtivoObj = inventarioConfig.getSistemaAtivo();
    const sistemaAtivoNome = sistemaAtivoObj?.nomeSistema || sistemaAtivoObj?.nome || sistemaAtivoObj?.sistema || null;

    try {
        const fichaAlvo = obterFichaAtiva(ownerUserId);
        if (!fichaAlvo) return true;

        let itensInventario = [];
        try {
            const invDb = dbInventario;
            garantirColunasInventario(invDb);
            const possiveisIds = [fichaAlvo.id, fichaAlvo.rowid, fichaAlvo.userId, ownerUserId].filter(Boolean).map(id => String(id));
            if (possiveisIds.length > 0) {
                const placeholders = possiveisIds.map(() => '?').join(',');
                itensInventario = invDb.prepare(`SELECT * FROM inventario_itens WHERE fichaId IN (${placeholders})`).all(...possiveisIds);
            }
        } catch (e) {}

        let configInventario = {};
        try {
            const cfgDb = new Database(path.resolve('sistemainventarioconfig-database.sqlite'), { readonly: true });
            const cfgRow = cfgDb.prepare('SELECT config_json FROM inventario_config WHERE sistema_nome = ?').get(fichaAlvo.sistemaNome || sistemaAtivoNome);
            cfgDb.close();
            if (cfgRow) configInventario = JSON.parse(cfgRow.config_json || '{}');
        } catch (e) {}

        let pesoTotalGeral = 0;
        itensInventario.forEach(item => { pesoTotalGeral += Number(item.peso) || 0; });

        let pesoStr = formatarNumeroBr(pesoTotalGeral) + 'kg';
        if (configInventario.pesoAtivo) {
            let dadosFicha = {};
            try { dadosFicha = JSON.parse(fichaAlvo.dadosJson || '{}'); } catch(e){}
            const pesoMaximo = calcularPesoMaximo(fichaAlvo.sistemaNome || sistemaAtivoNome, dadosFicha);
            if (pesoMaximo !== null) pesoStr = `${formatarNumeroBr(pesoTotalGeral)}/${formatarNumeroBr(pesoMaximo)}kg`;
        }

        const { embed, components } = construirVisualInventario(itensInventario, novaPagina, nomePersonagem, fichaAlvo.sistemaNome || sistemaAtivoNome, fichaAlvo.avatarNome || 'Desconhecido', pesoStr, ownerUserId);
        await interaction.editReply({ embeds: [embed], components: components });
    } catch (e) {}
    return true;
}

async function handleMessages(message) { return false; }

module.exports = verHandler;
module.exports.handleInteractions = handleInteractions;
module.exports.handleMessages = handleMessages;