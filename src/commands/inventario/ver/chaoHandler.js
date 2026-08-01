const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dbInventario = require('../database/dbInventario');

const chaoSessions = new Map();
const groundItemsMap = new Map(); // Armazena itens no chão ativos por ID de mensagem/sessão

function getFichasDb() {
    const rootDir = path.resolve('.');
    const arquivos = fs.readdirSync(rootDir);
    for (const file of arquivos) {
        if (file.endsWith('.sqlite') && !file.includes('database')) {
            try {
                const db = new Database(path.join(rootDir, file), { readonly: true });
                if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fichas'").get()) {
                    db.close();
                    return new Database(path.resolve(file));
                }
                db.close();
            } catch (e) {}
        }
    }
    return new Database(path.resolve('fichas.sqlite'));
}

module.exports = {
    async iniciarJogarFora(interaction, session) {
        const invDb = dbInventario;
        const itens = invDb.prepare('SELECT * FROM inventario_itens WHERE fichaId = ?').all(session.fichaId);

        if (!itens || itens.length === 0) return interaction.update({ content: '⚠️ Inventário vazio.', components: [] });

        const options = itens.slice(0, 25).map(i => ({
            label: String(i.nome).substring(0, 100),
            description: `Tipo: ${i.tipo} | Qnt: ${i.quantia || 1}`,
            value: String(i.id)
        }));

        chaoSessions.set(interaction.user.id, { step: 'selecionar_jogar', session, itensCache: itens });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('chao_selecionar_jogar')
                .setPlaceholder('Selecione os itens para jogar no chão...')
                .setMinValues(1)
                .setMaxValues(Math.min(options.length, 25))
                .addOptions(options)
        );

        return interaction.update({ content: '🗑️ Selecione os itens que deseja **jogar no chão**:', components: [row] });
    },

    async iniciarDarItemPlayer(interaction, session) {
        // Listar fichas de todos os jogadores no sistema ativo
        let dbFichas;
        try { dbFichas = getFichasDb(); } catch (e) { return interaction.update({ content: '❌ Erro ao buscar banco de fichas.', components: [] }); }

        const fichas = dbFichas.prepare('SELECT * FROM fichas WHERE sistemaNome = ?').all(session.sistemaAtivoNome);
        dbFichas.close();

        if (!fichas || fichas.length === 0) return interaction.update({ content: '❌ Não há outros personagens cadastrados neste sistema.', components: [] });

        const options = fichas.slice(0, 25).map(f => {
            let dados = {};
            try { dados = JSON.parse(f.dadosJson || '{}'); } catch(e){}
            const nomePers = dados.informacoesGerais?.nome || f.nomePersonagem || 'Personagem';
            return {
                label: String(nomePers).substring(0, 100),
                description: `Jogador: ${f.avatarNome || 'Desconhecido'}`,
                value: String(f.id || f.rowid || f.userId)
            };
        });

        chaoSessions.set(interaction.user.id, { step: 'dar_selecionar_alvo', session, fichasCache: fichas });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('chao_dar_alvo')
                .setPlaceholder('Para quem deseja dar o item?')
                .addOptions(options)
        );

        return interaction.update({ content: '🎁 Selecione o personagem que receberá o item:', components: [row] });
    },

    async handleInteractions(interaction) {
        const userId = interaction.user.id;
        const customId = interaction.customId;
        const chaoState = chaoSessions.get(userId);

        if (customId === 'chao_selecionar_jogar' && chaoState) {
            chaoState.idsJogar = interaction.values;
            const itensSelecionados = chaoState.itensCache.filter(i => chaoState.idsJogar.includes(String(i.id)));
            chaoState.itensParaJogar = itensSelecionados;

            // Filtrar itens com quantia > 1 para perguntar quantidade
            chaoState.itensComQuantidade = itensSelecionados.filter(i => i.tipo === 'comum' && (i.quantia || 1) > 1);
            chaoState.quantidadesJogar = {};

            if (chaoState.itensComQuantidade.length > 0) {
                chaoState.currentIndex = 0;
                chaoState.step = 'perguntar_qtd_jogar';
                const primeiro = chaoState.itensComQuantidade[0];
                return interaction.update({ content: `🔢 Quantas unidades de **${primeiro.nome}** deseja jogar no fora? (Você possui ${primeiro.quantia}). Responda no chat.`, components: [] });
            }

            return finalizarJogarAoChao(interaction, chaoState);
        }

        if (customId === 'chao_dar_alvo' && chaoState) {
            chaoState.alvoFichaId = interaction.values[0];
            const invDb = dbInventario;
            const itensGiver = invDb.prepare('SELECT * FROM inventario_itens WHERE fichaId = ?').all(chaoState.session.fichaId);

            if (!itensGiver || itensGiver.length === 0) {
                chaoSessions.delete(userId);
                return interaction.update({ content: '⚠️ Seu inventário está vazio.', components: [] });
            }

            chaoState.itensGiverCache = itensGiver;
            chaoState.step = 'dar_selecionar_itens';

            const options = itensGiver.slice(0, 25).map(i => ({
                label: String(i.nome).substring(0, 100),
                description: `Tipo: ${i.tipo} | Qnt: ${i.quantia || 1}`,
                value: String(i.id)
            }));

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('chao_dar_itens_menu')
                    .setPlaceholder('Selecione os itens que deseja dar...')
                    .setMinValues(1)
                    .setMaxValues(Math.min(options.length, 25))
                    .addOptions(options)
            );

            return interaction.update({ content: '🎁 Selecione os itens que deseja dar:', components: [row] });
        }

        if (customId === 'chao_dar_itens_menu' && chaoState) {
            chaoState.idsDar = interaction.values;
            const itensDar = chaoState.itensGiverCache.filter(i => chaoState.idsDar.includes(String(i.id)));
            chaoState.itensParaDar = itensDar;

            const nomesItens = itensDar.map(i => i.nome).join(', ');
            let dbFichas = getFichasDb();
            const fichaAlvo = dbFichas.prepare('SELECT * FROM fichas WHERE id = ? OR rowid = ? OR userId = ?').get(chaoState.alvoFichaId, chaoState.alvoFichaId, chaoState.alvoFichaId);
            dbFichas.close();

            let dadosAlvo = {};
            try { dadosAlvo = JSON.parse(fichaAlvo.dadosJson || '{}'); } catch(e){}
            const nomeAlvo = dadosAlvo.informacoesGerais?.nome || fichaAlvo?.nomePersonagem || 'Personagem';
            const playerAlvo = fichaAlvo?.avatarNome || 'Player';

            chaoState.nomeAlvoStr = nomeAlvo;
            chaoState.playerAlvoStr = playerAlvo;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('chao_dar_sim').setLabel('Sim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('chao_dar_nao').setLabel('Não').setStyle(ButtonStyle.Danger)
            );

            chaoState.step = 'dar_confirmacao';
            return interaction.update({ content: `❓ Quer mesmo dar o(s) item(ns) **${nomesItens}** para **${nomeAlvo} | ${playerAlvo}**?`, components: [row] });
        }

        if (customId === 'chao_dar_sim' || customId === 'chao_dar_nao') {
            if (!chaoState) return interaction.reply({ content: '⚠️ Sessão expirada.', flags: [MessageFlags.Ephemeral] });
            if (customId === 'chao_dar_nao') {
                chaoSessions.delete(userId);
                return interaction.update({ content: '❌ Sistema de dar itens cancelado.', components: [] });
            }

            // Verificar itens com quantia > 1 para dar
            chaoState.itensComQtdDar = chaoState.itensParaDar.filter(i => i.tipo === 'comum' && (i.quantia || 1) > 1);
            chaoState.quantidadesDar = {};

            if (chaoState.itensComQtdDar.length > 0) {
                chaoState.currentIndex = 0;
                chaoState.step = 'perguntar_qtd_dar';
                const primeiro = chaoState.itensComQtdDar[0];
                return interaction.update({ content: `🔢 Quantos do item **${primeiro.nome}** deseja dar? (Você possui ${primeiro.quantia} no seu inventário). Responda no chat.`, components: [] });
            }

            return finalizarDarItens(interaction, chaoState);
        }

        if (customId === 'chao_pegar_btn') {
            const groundKey = interaction.message.id;
            const groundData = groundItemsMap.get(groundKey);

            if (!groundData) return interaction.reply({ content: '⚠️ Estes itens já foram pegos ou expiraram.', flags: [MessageFlags.Ephemeral] });

            if (groundData.pickingUser && groundData.pickingUser !== userId) {
                return interaction.reply({ content: `⏳ Espere, **${groundData.pickingUserName}** está escolhendo o que pegar do chão.`, flags: [MessageFlags.Ephemeral] });
            }

            groundData.pickingUser = userId;
            groundData.pickingUserName = interaction.user.username;

            const options = groundData.itensNoChao.map((i, idx) => ({
                label: String(i.nome).substring(0, 100),
                description: `Disponível: ${i.quantia || 1} | Tipo: ${i.tipo}`,
                value: String(idx)
            }));

            chaoSessions.set(userId, { step: 'pegar_selecionar', groundKey, groundData, interactionOriginal: interaction });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('chao_pegar_menu')
                    .setPlaceholder('Quais itens quer pegar?')
                    .setMinValues(1)
                    .setMaxValues(Math.min(options.length, 25))
                    .addOptions(options)
            );

            return interaction.reply({ content: '🎒 Quais itens quer pegar?', components: [row], flags: [MessageFlags.Ephemeral] });
        }

        if (customId === 'chao_pegar_menu' && chaoState && chaoState.step === 'pegar_selecionar') {
            chaoState.indicesEscolhidos = interaction.values.map(v => parseInt(v));
            chaoState.currentIndex = 0;
            chaoState.quantidadesPegar = {};
            chaoState.step = 'pegar_qtd';

            const primeiroItem = chaoState.groundData.itensNoChao[chaoState.indicesEscolhidos[0]];
            return interaction.update({ content: `🔢 Quantas unidades de **${primeiroItem.nome}** quer pegar? O chão possui **${primeiroItem.quantia || 1}**. Responda no chat.`, components: [] });
        }

        return false;
    },

    async handleMessages(message) {
        if (message.author.bot) return false;
        const userId = message.author.id;
        const chaoState = chaoSessions.get(userId);
        if (!chaoState) return false;

        const conteudo = message.content.trim();
        try { await message.delete(); } catch(e){}

        if (chaoState.step === 'perguntar_qtd_jogar') {
            const qtd = parseInt(conteudo);
            const itemAtual = chaoState.itensComQuantidade[chaoState.currentIndex];

            if (isNaN(qtd) || qtd <= 0 || qtd > (itemAtual.quantia || 1)) {
                return message.channel.send(`⚠️ Você não possui essa quantia de item, fale uma quantia valida, você só possui **${itemAtual.quantia}** de **${itemAtual.nome}**.`).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            chaoState.quantidadesJogar[itemAtual.id] = qtd;
            chaoState.currentIndex++;

            if (chaoState.currentIndex < chaoState.itensComQuantidade.length) {
                const proximo = chaoState.itensComQuantidade[chaoState.currentIndex];
                return message.channel.send(`🔢 Quantas unidades de **${proximo.nome}** quer jogar fora? (Você possui ${proximo.quantia})`).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            chaoSessions.delete(userId);
            return executarJogarForaFinal(message.channel, chaoState);
        }

        if (chaoState.step === 'perguntar_qtd_dar') {
            const qtd = parseInt(conteudo);
            const itemAtual = chaoState.itensComQtdDar[chaoState.currentIndex];

            if (isNaN(qtd) || qtd <= 0 || qtd > (itemAtual.quantia || 1)) {
                return message.channel.send(`⚠️ Você não possui essa quantia de item, fale uma quantia valida, você só possui **${itemAtual.quantia}** de **${itemAtual.nome}**.`).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            chaoState.quantidadesDar[itemAtual.id] = qtd;
            chaoState.currentIndex++;

            if (chaoState.currentIndex < chaoState.itensComQtdDar.length) {
                const proximo = chaoState.itensComQtdDar[chaoState.currentIndex];
                return message.channel.send(`🔢 Quantos do item **${proximo.nome}** deseja dar? (Você possui ${proximo.quantia} no seu inventário)`).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            chaoSessions.delete(userId);
            return executarDarFinal(message.channel, chaoState);
        }

        if (chaoState.step === 'pegar_qtd') {
            const qtd = parseInt(conteudo);
            const indexItem = chaoState.indicesEscolhidos[chaoState.currentIndex];
            const itemChao = chaoState.groundData.itensNoChao[indexItem];

            if (isNaN(qtd) || qtd <= 0 || qtd > (itemChao.quantia || 1)) {
                return message.channel.send(`⚠️ Não tem essa quantia no chão. O chão possui apenas **${itemChao.quantia || 1}** de **${itemChao.nome}**. Fale uma quantia válida:`).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            chaoState.quantidadesPegar[indexItem] = qtd;
            chaoState.currentIndex++;

            if (chaoState.currentIndex < chaoState.indicesEscolhidos.length) {
                const proximoItem = chaoState.groundData.itensNoChao[chaoState.indicesEscolhidos[chaoState.currentIndex]];
                return message.channel.send(`🔢 Quantas unidades de **${proximoItem.nome}** quer pegar? O chão possui **${proximoItem.quantia || 1}**:`).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
            }

            chaoSessions.delete(userId);
            return executarPegarFinal(message, chaoState);
        }

        return false;
    }
};

async function finalizarJogarAoChao(interaction, chaoState) {
    executarJogarForaFinal(interaction.channel, chaoState);
    return interaction.update({ content: '✅ Itens jogados no chão com sucesso!', components: [] });
}

function executarJogarForaFinal(channel, chaoState) {
    const invDb = dbInventario;
    const itensJogados = [];

    for (const item of chaoState.itensParaJogar) {
        const qtdJogar = chaoState.quantidadesJogar[item.id] !== undefined ? chaoState.quantidadesJogar[item.id] : (item.quantia || 1);
        if (item.tipo === 'comum' && qtdJogar < (item.quantia || 1)) {
            const novaQtd = item.quantia - qtdJogar;
            const novoPeso = (item.peso / item.quantia) * novaQtd;
            invDb.prepare('UPDATE inventario_itens SET quantia = ?, peso = ? WHERE id = ?').run(novaQtd, novoPeso, item.id);
        } else {
            invDb.prepare('DELETE FROM inventario_itens WHERE id = ?').run(item.id);
        }
        itensJogados.push({ ...item, quantia: qtdJogar });
    }

    const nomesItensStr = itensJogados.map(i => `${i.quantia > 1 ? i.quantia + 'x ' : ''}${i.nome}`).join(', ');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('chao_pegar_btn').setLabel('Pegar').setStyle(ButtonStyle.Primary).setEmoji('🖐️')
    );

    channel.send({ content: `📦 **${chaoState.session.nomePersonagem}** jogou **${nomesItensStr}** no chão`, components: [row] }).then(msg => {
        const timer = setTimeout(() => {
            groundItemsMap.delete(msg.id);
            msg.delete().catch(() => {});
        }, 20 * 60 * 1000); // 20 minutos

        groundItemsMap.set(msg.id, {
            itensNoChao: itensJogados,
            timer,
            pickingUser: null
        });
    });
}

function finalizarDarItens(interaction, chaoState) {
    executarDarFinal(interaction.channel, chaoState);
    return interaction.update({ content: `✅ Itens enviados para **${chaoState.nomeAlvoStr}** com sucesso!`, components: [] });
}

function executarDarFinal(channel, chaoState) {
    const invDb = dbInventario;
    const insert = invDb.prepare(`INSERT INTO inventario_itens (fichaId, tipo, itemId, nome, quantia, peso, dadoDano, bonusDano, bonusCa, penalidadeDestreza, descricao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    for (const item of chaoState.itensParaDar) {
        const qtdDar = chaoState.quantidadesDar[item.id] !== undefined ? chaoState.quantidadesDar[item.id] : (item.quantia || 1);
        
        // Remove/atualiza do giver
        if (item.tipo === 'comum' && qtdDar < (item.quantia || 1)) {
            const novaQtd = item.quantia - qtdDar;
            const novoPeso = (item.peso / item.quantia) * novaQtd;
            invDb.prepare('UPDATE inventario_itens SET quantia = ?, peso = ? WHERE id = ?').run(novaQtd, novoPeso, item.id);
        } else {
            invDb.prepare('DELETE FROM inventario_itens WHERE id = ?').run(item.id);
        }

        // Adiciona ao receiver
        const pesoUnitario = item.tipo === 'comum' ? (item.peso / (item.quantia || 1)) : item.peso;
        const pesoTotal = pesoUnitario * qtdDar;

        if (item.tipo === 'comum') {
            const existente = invDb.prepare('SELECT * FROM inventario_itens WHERE fichaId = ? AND itemId = ? AND tipo = ?').get(chaoState.alvoFichaId, String(item.itemId || item.id), 'comum');
            if (existente) {
                const novaQtdAlvo = existente.quantia + qtdDar;
                const novoPesoAlvo = (existente.peso / existente.quantia) * novaQtdAlvo;
                invDb.prepare('UPDATE inventario_itens SET quantia = ?, peso = ? WHERE id = ?').run(novaQtdAlvo, novoPesoAlvo, existente.id);
            } else {
                insert.run(chaoState.alvoFichaId, 'comum', String(item.itemId || item.id), item.nome, qtdDar, pesoTotal, null, null, null, null, item.descricao || '');
            }
        } else {
            insert.run(chaoState.alvoFichaId, item.tipo, String(item.itemId || item.id), item.nome, 1, pesoTotal, item.dadoDano, item.bonusDano, item.bonusCa, item.penalidadeDestreza, item.descricao || '');
        }
    }
    channel.send(`🎁 Itens transferidos com sucesso para **${chaoState.nomeAlvoStr}**!`).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
}

function executarPegarFinal(message, chaoState) {
    const groundKey = chaoState.groundData;
    // Identificar personagem ativo da pessoa que pegou
    let dbFichas;
    try { dbFichas = getFichasDb(); } catch(e){}
    const fichasUser = dbFichas.prepare('SELECT * FROM fichas WHERE userId = ? OR id = ?').all(message.author.id, message.author.id);
    dbFichas.close();

    const fichaPegou = fichasUser[0];
    let dadosFicha = {};
    try { dadosFicha = JSON.parse(fichaPegou.dadosJson || '{}'); } catch(e){}
    const nomePersPegou = dadosFicha.informacoesGerais?.nome || fichaPegou?.nomePersonagem || message.author.username;
    const fichaIdPegou = fichaPegou?.id || fichaPegou?.rowid || message.author.id;

    const invDb = dbInventario;
    const insert = invDb.prepare(`INSERT INTO inventario_itens (fichaId, tipo, itemId, nome, quantia, peso, dadoDano, bonusDano, bonusCa, penalidadeDestreza, descricao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const itensPegosNomes = [];
    const chaoObj = groundItemsMap.get(chaoState.groundKey);

    if (!chaoObj) return message.channel.send('⚠️ Os itens do chão não existem mais.');

    for (const index of chaoState.indicesEscolhidos) {
        const itemChao = chaoObj.itensNoChao[index];
        if (!itemChao) continue;

        const qtdPegar = chaoState.quantidadesPegar[index] || (itemChao.quantia || 1);
        itensPegosNomes.push(`${qtdPegar > 1 ? qtdPegar + 'x ' : ''}${itemChao.nome}`);

        const pesoUnitario = itemChao.tipo === 'comum' ? (itemChao.peso / (itemChao.quantia || 1)) : itemChao.peso;
        const pesoTotal = pesoUnitario * qtdPegar;

        if (itemChao.tipo === 'comum') {
            const existente = invDb.prepare('SELECT * FROM inventario_itens WHERE fichaId = ? AND itemId = ? AND tipo = ?').get(fichaIdPegou, String(itemChao.itemId || itemChao.id), 'comum');
            if (existente) {
                const novaQtd = existente.quantia + qtdPegar;
                const novoPeso = (existente.peso / existente.quantia) * novaQtd;
                invDb.prepare('UPDATE inventario_itens SET quantia = ?, peso = ? WHERE id = ?').run(novaQtd, novoPeso, existente.id);
            } else {
                insert.run(fichaIdPegou, 'comum', String(itemChao.itemId || itemChao.id), itemChao.nome, qtdPegar, pesoTotal, null, null, null, null, itemChao.descricao || '');
            }
        } else {
            insert.run(fichaIdPegou, itemChao.tipo, String(itemChao.itemId || itemChao.id), itemChao.nome, 1, pesoTotal, itemChao.dadoDano, itemChao.bonusDano, itemChao.bonusCa, itemChao.penalidadeDestreza, itemChao.descricao || '');
        }

        // Atualizar ou remover do chão
        if (itemChao.tipo === 'comum' && qtdPegar < (itemChao.quantia || 1)) {
            itemChao.quantia -= qtdPegar;
            itemChao.peso = pesoUnitario * itemChao.quantia;
        } else {
            chaoObj.itensNoChao[index] = null;
        }
    }

    chaoObj.itensNoChao = chaoObj.itensNoChao.filter(i => i !== null);
    chaoObj.pickingUser = null;

    const msgOriginal = message.channel.messages.cache.get(chaoState.groundKey) || message.channel.messages.fetch(chaoState.groundKey).catch(()=>{});

    if (chaoObj.itensNoChao.length === 0) {
        clearTimeout(chaoObj.timer);
        groundItemsMap.delete(chaoState.groundKey);
        if (msgOriginal && typeof msgOriginal.delete === 'function') msgOriginal.delete().catch(()=>{});
        message.channel.send(`🎒 **${nomePersPegou}** pegou **${itensPegosNomes.join(', ')}** do chão, não há mais nada no chão.`);
    } else {
        const sobraramStr = chaoObj.itensNoChao.map(i => `${i.quantia > 1 ? i.quantia + 'x ' : ''}${i.nome}`).join(', ');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('chao_pegar_btn').setLabel('Pegar').setStyle(ButtonStyle.Primary).setEmoji('🖐️')
        );
        if (msgOriginal && typeof msgOriginal.edit === 'function') {
            msgOriginal.edit({ content: `📦 Os itens **${sobraramStr}** continuam no chão`, components: [row] }).catch(()=>{});
        }
        message.channel.send(`🎒 **${nomePersPegou}** pegou os itens **${itensPegosNomes.join(', ')}** do chão.`);
    }
}