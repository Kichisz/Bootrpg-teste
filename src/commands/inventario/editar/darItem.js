const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dbInventario = require('../database/dbInventario');

const sessionDar = new Map();

function calcularPesoMaximoFicha(sistemaNome, fichaId) {
    try {
        const rootDir = path.resolve('.');
        const arquivos = fs.readdirSync(rootDir);
        let dbFichas;
        for (const file of arquivos) {
            if (file.endsWith('.sqlite') && file !== 'sistemaativo-database.sqlite' && file !== 'sistemainventarioconfig-database.sqlite' && file !== 'pesoconfig-database.sqlite' && file !== 'inventarioplayers-database.sqlite') {
                try {
                    const test = new Database(path.join(rootDir, file), { readonly: true });
                    if (test.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fichas'").get()) {
                        dbFichas = test;
                        break;
                    }
                    test.close();
                } catch(e){}
            }
        }
        if (!dbFichas) dbFichas = new Database(path.resolve('fichas.sqlite'), { readonly: true });
        
        const ficha = dbFichas.prepare('SELECT dadosJson FROM fichas WHERE id = ? OR rowid = ?').get(fichaId, fichaId);
        dbFichas.close();

        if (!ficha) return null;
        const dadosFicha = JSON.parse(ficha.dadosJson || '{}');

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
            const mult = Number(pConfig.multiplicador) || 1;
            return valorAtrib * mult;
        }
    } catch(e) {}
    return null;
}

// Função auxiliar robusta para buscar todos os IDs possíveis de uma ficha
function obterIdsPossiveisFicha(fichaId) {
    let ids = [String(fichaId)];
    try {
        const rootDir = path.resolve('.');
        const arquivos = fs.readdirSync(rootDir);
        let dbFichas;
        for (const file of arquivos) {
            if (file.endsWith('.sqlite') && !file.includes('database')) {
                try {
                    const test = new Database(path.join(rootDir, file), { readonly: true });
                    if (test.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fichas'").get()) {
                        dbFichas = test;
                        break;
                    }
                    test.close();
                } catch(e){}
            }
        }
        if (!dbFichas) dbFichas = new Database(path.resolve('fichas.sqlite'), { readonly: true });

        const ficha = dbFichas.prepare('SELECT id, rowid, userId FROM fichas WHERE id = ? OR rowid = ? OR userId = ?').get(fichaId, fichaId, fichaId);
        dbFichas.close();
        if (ficha) {
            if (ficha.id) ids.push(String(ficha.id));
            if (ficha.rowid) ids.push(String(ficha.rowid));
            if (ficha.userId) ids.push(String(ficha.userId));
        }
    } catch (e) {}
    return [...new Set(ids.filter(Boolean))];
}

module.exports = {
    async iniciar(interaction, targetUserId, fichaId, sistemaAtivoNome) {
        sessionDar.set(interaction.user.id, { targetUserId, fichaId: String(fichaId), sistemaAtivoNome });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`dar_cat_${targetUserId}`)
                .setPlaceholder('Escolha a categoria do item...')
                .addOptions([
                    { label: 'Item Comum', value: 'comum', description: 'Itens genéricos e consumíveis criados', emoji: '📦' },
                    { label: 'Arma', value: 'arma', description: 'Armas cadastradas no sistema', emoji: '⚔️' },
                    { label: 'Armadura', value: 'armadura', description: 'Armaduras cadastradas no sistema', emoji: '🛡️' }
                ])
        );

        return interaction.update({ content: '📦 Selecione a **categoria** do item que deseja dar:', components: [row], embeds: [] });
    },

    async handleInteractions(interaction) {
        const customId = interaction.customId;
        if (!customId) return false;

        if (customId.startsWith('dar_cat_')) {
            const session = sessionDar.get(interaction.user.id);
            if (!session) return interaction.reply({ content: '⚠️ Sessão expirada.', flags: [MessageFlags.Ephemeral] });

            const categoria = interaction.values[0];
            session.categoria = categoria;
            const activeSys = session.sistemaAtivoNome;

            let lista = [];
            try {
                if (categoria === 'comum') {
                    const dbItens = new Database(path.resolve('Itenstabela-database.sqlite'), { readonly: true });
                    lista = dbItens.prepare('SELECT * FROM itens WHERE LOWER(TRIM(systemName)) = LOWER(TRIM(?))').all(activeSys);
                    if (!lista || lista.length === 0) lista = dbItens.prepare('SELECT * FROM itens').all();
                    dbItens.close();
                } else if (categoria === 'arma') {
                    const dbArmas = new Database(path.resolve('Armastabela-database.sqlite'), { readonly: true });
                    lista = dbArmas.prepare('SELECT * FROM armas WHERE LOWER(TRIM(systemName)) = LOWER(TRIM(?))').all(activeSys);
                    if (!lista || lista.length === 0) lista = dbArmas.prepare('SELECT * FROM armas').all();
                    dbArmas.close();
                } else if (categoria === 'armadura') {
                    const dbArmaduras = new Database(path.resolve('Armadurasstabela-database.sqlite'), { readonly: true });
                    lista = dbArmaduras.prepare('SELECT * FROM armaduras WHERE LOWER(TRIM(systemName)) = LOWER(TRIM(?))').all(activeSys);
                    if (!lista || lista.length === 0) lista = dbArmaduras.prepare('SELECT * FROM armaduras').all();
                    dbArmaduras.close();
                }
            } catch (e) {}

            if (!lista || lista.length === 0) {
                return interaction.update({ content: `❌ Não há registros de ${categoria}s cadastrados para o sistema ativo (**${activeSys}**).`, components: [] });
            }

            session.listaCache = lista;

            const options = lista.slice(0, 25).map(item => ({
                label: String(item.nome).substring(0, 100),
                description: `ID: ${item.id} | Peso: ${item.peso || 0}kg`,
                value: String(item.id)
            }));

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`dar_selecionar_itens_${session.targetUserId}`)
                    .setPlaceholder('Selecione um ou mais itens...')
                    .setMinValues(1)
                    .setMaxValues(Math.min(options.length, 25))
                    .addOptions(options)
            );

            return interaction.update({ content: `📋 Selecione abaixo os(as) **${categoria}s** que deseja dar:`, components: [row] });
        }

        if (customId.startsWith('dar_selecionar_itens_')) {
            const session = sessionDar.get(interaction.user.id);
            if (!session) return interaction.reply({ content: '⚠️ Sessão expirada.', flags: [MessageFlags.Ephemeral] });

            session.selectedIds = interaction.values;
            const selecionadosNomes = session.listaCache
                .filter(i => session.selectedIds.includes(String(i.id)))
                .map(i => i.nome)
                .join(', ');

            session.selecionadosNomesStr = selecionadosNomes;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dar_conf_sim').setLabel('Sim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('dar_conf_nao').setLabel('Não').setStyle(ButtonStyle.Danger)
            );

            return interaction.update({ content: `Deseja dar os(as) **${session.categoria}s**: **${selecionadosNomes}**?`, components: [row] });
        }

        if (customId === 'dar_conf_sim' || customId === 'dar_conf_nao') {
            const session = sessionDar.get(interaction.user.id);
            if (!session) return interaction.reply({ content: '⚠️ Sessão expirada.', flags: [MessageFlags.Ephemeral] });

            if (customId === 'dar_conf_nao') {
                sessionDar.delete(interaction.user.id);
                return interaction.update({ content: '❌ Operação cancelada.', components: [] });
            }

            if (session.categoria === 'comum') {
                session.currentIndex = 0;
                session.quantidadesDadas = {};
                return perguntarProximaQuantidadeComum(interaction, session);
            } else {
                const erroLimite = verificarLimitesAntesDeSalvar(session, [{ id: session.selectedIds[0], qtd: 1 }]);
                if (erroLimite) {
                    sessionDar.delete(interaction.user.id);
                    return interaction.update({ content: erroLimite, components: [] });
                }

                salvarItensNoInventario(session);
                sessionDar.delete(interaction.user.id);
                return interaction.update({ content: `✅ As armas/armaduras (**${session.selecionadosNomesStr}**) foram adicionadas com sucesso ao inventário!`, components: [] });
            }
        }
        return false;
    },

    async handleMessages(message) {
        const session = sessionDar.get(message.author.id);
        if (!session || !session.waitingForQuantity) return false;

        const qtd = parseInt(message.content.trim());
        if (isNaN(qtd) || qtd <= 0) {
            message.reply('⚠️ Informe um número válido maior que 0.').catch(() => {});
            return true;
        }

        try { await message.delete(); } catch (e) {}

        const currentId = session.selectedIds[session.currentIndex];
        session.quantidadesDadas[currentId] = qtd;
        session.currentIndex++;

        if (session.currentIndex < session.selectedIds.length) {
            return perguntarProximaQuantidadeComum(null, session, message.channel);
        } else {
            const itensParaSalvar = session.selectedIds.map(id => ({ id, qtd: session.quantidadesDadas[id] || 1 }));
            const erroLimite = verificarLimitesAntesDeSalvar(session, itensParaSalvar);
            if (erroLimite) {
                sessionDar.delete(message.author.id);
                if (session.lastInteraction) {
                    return session.lastInteraction.editReply({ content: erroLimite, components: [] }).catch(() => {});
                }
                return message.channel.send(erroLimite).catch(() => {});
            }

            salvarItensNoInventario(session);
            sessionDar.delete(message.author.id);
            if (session.lastInteraction) {
                session.lastInteraction.editReply({ content: `✅ Itens adicionados com sucesso ao inventário do personagem!`, components: [] }).catch(() => {});
            }
            return true;
        }
    }
};

async function perguntarProximaQuantidadeComum(interaction, session, channelObj = null) {
    const currentId = session.selectedIds[session.currentIndex];
    const itemObj = session.listaCache.find(i => String(i.id) === String(currentId));

    const text = `🔢 Dar quantos do item **${itemObj ? itemObj.nome : 'Item'}** (ID: ${currentId}) para o personagem? (Responda com o número no chat)`;
    if (interaction) {
        session.lastInteraction = interaction;
        await interaction.update({ content: text, components: [] });
    } else if (channelObj) {
        const msg = await channelObj.send(text);
        session.lastMessageId = msg.id;
    }
    session.waitingForQuantity = true;
}

function verificarLimitesAntesDeSalvar(session, novosItens) {
    let config = {};
    try {
        const cfgDb = new Database(path.resolve('sistemainventarioconfig-database.sqlite'), { readonly: true });
        const row = cfgDb.prepare('SELECT config_json FROM inventario_config WHERE sistema_nome = ?').get(session.sistemaAtivoNome);
        cfgDb.close();
        if (row) config = JSON.parse(row.config_json || '{}');
    } catch (e) {}

    const invDb = dbInventario;
    const possiveisIds = obterIdsPossiveisFicha(session.fichaId);
    const placeholders = possiveisIds.map(() => '?').join(',');
    const itensAtuais = invDb.prepare(`SELECT * FROM inventario_itens WHERE fichaId IN (${placeholders})`).all(...possiveisIds);

    if (config.quantiaAtiva && config.quantiaMax) {
        let totalQtdAtual = itensAtuais.reduce((acc, i) => acc + (i.tipo === 'comum' ? (i.quantia || 1) : 1), 0);
        let qtdAdicionar = novosItens.reduce((acc, n) => acc + n.qtd, 0);

        if ((totalQtdAtual + qtdAdicionar) > Number(config.quantiaMax)) {
            return `❌ **Ação Bloqueada:** O inventário atingirá o limite máximo de **${config.quantiaMax} itens** permitidos por este sistema!`;
        }
    }

    if (config.pesoAtivo) {
        const pesoMax = calcularPesoMaximoFicha(session.sistemaAtivoNome, session.fichaId);
        if (pesoMax !== null) {
            let pesoAtual = itensAtuais.reduce((acc, i) => acc + (Number(i.peso) || 0), 0);
            let pesoAdicionar = 0;

            for (const ni of novosItens) {
                const itemObj = session.listaCache.find(i => String(i.id) === String(ni.id));
                if (itemObj) {
                    pesoAdicionar += (Number(itemObj.peso) || 0) * ni.qtd;
                }
            }

            if ((pesoAtual + pesoAdicionar) > pesoMax) {
                let pesoConfig = {};
                try {
                    const pDb = new Database(path.resolve('pesoconfig-database.sqlite'), { readonly: true });
                    const pRow = pDb.prepare('SELECT peso_json FROM peso_config WHERE sistema_nome = ?').get(session.sistemaAtivoNome);
                    pDb.close();
                    if (pRow) pesoConfig = JSON.parse(pRow.peso_json || '{}');
                } catch(e) {}

                if (pesoConfig.punicao !== 'penalidade') {
                    return `❌ **Ação Bloqueada:** O peso total resultante (**${(pesoAtual + pesoAdicionar).toFixed(1)}kg**) ultrapassará o limite máximo permitido de **${pesoMax}kg**!`;
                }
            }
        }
    }

    return null;
}

function salvarItensNoInventario(session) {
    const invDb = dbInventario;
    invDb.prepare(`
        CREATE TABLE IF NOT EXISTS inventario_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fichaId TEXT,
            tipo TEXT,
            itemId TEXT,
            nome TEXT,
            quantia INTEGER,
            peso REAL,
            dadoDano TEXT,
            bonusDano TEXT,
            bonusCa TEXT,
            penalidadeDestreza TEXT,
            descricao TEXT,
            equipado INTEGER DEFAULT 0
        )
    `).run();

    const insert = invDb.prepare(`
        INSERT INTO inventario_itens (fichaId, tipo, itemId, nome, quantia, peso, dadoDano, bonusDano, bonusCa, penalidadeDestreza, descricao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const targetFichaId = String(session.fichaId);
    const possiveisIds = obterIdsPossiveisFicha(session.fichaId);
    const placeholders = possiveisIds.map(() => '?').join(',');

    for (const idStr of session.selectedIds) {
        const item = session.listaCache.find(i => String(i.id) === String(idStr));
        if (!item) continue;

        if (session.categoria === 'comum') {
            const qtd = session.quantidadesDadas?.[idStr] || 1;
            const pesoUnitario = item.peso || 0;
            
            const existente = invDb.prepare(`SELECT * FROM inventario_itens WHERE fichaId IN (${placeholders}) AND itemId = ? AND tipo = ?`).get(...possiveisIds, String(item.id), 'comum');
            if (existente) {
                const novaQtd = existente.quantia + qtd;
                const novoPeso = pesoUnitario * novaQtd;
                invDb.prepare('UPDATE inventario_itens SET quantia = ?, peso = ? WHERE id = ?').run(novaQtd, novoPeso, existente.id);
            } else {
                const pesoTotal = pesoUnitario * qtd;
                insert.run(targetFichaId, 'comum', String(item.id), item.nome, qtd, pesoTotal, null, null, null, null, item.descricao || '');
            }
        } else if (session.categoria === 'arma') {
            insert.run(targetFichaId, 'arma', String(item.id), item.nome, 1, item.peso || 0, item.dadoDano || '', item.bonusDano || '', null, null, item.descricao || '');
        } else if (session.categoria === 'armadura') {
            insert.run(targetFichaId, 'armadura', String(item.id), item.nome, 1, item.peso || 0, null, null, item.bonusCa || '', item.penalidadeDestreza || '', item.descricao || '');
        }
    }
}