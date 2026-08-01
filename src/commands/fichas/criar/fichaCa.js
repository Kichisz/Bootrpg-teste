const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('better-sqlite3');

function carregarSistemaConfig(session) {
    if (session.sistemaConfig) return session.sistemaConfig;
    try {
        const activeDb = new Database('sistemaativo-database.sqlite', { readonly: true });
        const row = activeDb.prepare('SELECT conteudo_json FROM sistema_ativo LIMIT 1').get();
        activeDb.close();
        if (row && row.conteudo_json) {
            session.sistemaConfig = JSON.parse(row.conteudo_json);
        }
    } catch (err) {
        console.error('Erro ao carregar sistema ativo para CA:', err);
    }
    return session.sistemaConfig || {};
}

async function enviarOuEditar(target, payload, session) {
    if (session.botMessage && typeof session.botMessage.edit === 'function') {
        try {
            session.botMessage = await session.botMessage.edit(payload);
            return session.botMessage;
        } catch (e) {}
    }
    if (target && (target.isCommand?.() || target.isStringSelectMenu?.() || target.isButton?.())) {
        if (target.replied || target.deferred) {
            session.botMessage = await target.editReply(payload).catch(() => {});
            return session.botMessage;
        } else {
            return await target.update(payload).catch(() => {});
        }
    }
    const channel = target.channel || target;
    if (channel && typeof channel.send === 'function') {
        session.botMessage = await channel.send(payload).catch(() => {});
        return session.botMessage;
    }
}

async function iniciar(message, session) {
    const config = carregarSistemaConfig(session);
    if (!config.temCa) {
        session.etapaAtual = 'arma_simnao';
        const fichaArma = require('./fichaArma');
        return fichaArma.iniciarSimNao(message, session);
    }

    const caNome = config.caNome || 'CA';
    session.caData = {};
    session.caSubEtapa = 'escolhendo_metodo';
    session.etapaAtual = 'ca';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🛡️ Passo 10/12 — Defesa / Armadura (${caNome})`)
        .setDescription(
            `A **${caNome}** representa a dificuldade que o inimigo tem para acertar ataques em você.\n\n` +
            `Como você deseja calcular ou definir a sua **${caNome}**? Selecione uma das opções abaixo no menu:`
        );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ca_metodo')
        .setPlaceholder('Escolha o método de cálculo da CA...')
        .addOptions([
            { label: 'Valor Fixo', value: 'valor_fixo', description: 'Usa apenas um número estático.' },
            { label: 'Atributo', value: 'atributo', description: 'Calculada com base em atributo(s).' },
            { label: 'Valor Fixo + Atributo', value: 'valor_fixo_atributo', description: 'Base estática somada a atributo(s).' },
            { label: 'Rolagem de Dado', value: 'rolagem_dado', description: 'Rola um dado para definir a CA.' },
            { label: 'Rolagem de Dado + Atributo', value: 'rolagem_dado_atributo', description: 'Soma o resultado de um dado com atributo(s).' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const payload = { embeds: [embed], components: [row] };
    
    const msg = await enviarOuEditar(message, payload, session);
    if (msg) session.botMessage = msg;

    const filter = i => i.user.id === (message.author?.id || message.user?.id);
    const collector = session.botMessage.createMessageComponentCollector({ filter, time: 300000, max: 1 });

    collector.on('collect', async interaction => {
        await interaction.deferUpdate();
        const metodo = interaction.values[0];
        session.caData.metodo = metodo;

        if (metodo === 'valor_fixo') {
            session.caSubEtapa = 'aguardando_valor_fixo';
            await pedirValorFixo(message, session);
        } else if (metodo === 'atributo') {
            session.caSubEtapa = 'aguardando_atributos';
            await pedirAtributos(message, session);
        } else if (metodo === 'valor_fixo_atributo') {
            session.caSubEtapa = 'aguardando_valor_fixo_com_atributo';
            await pedirValorFixo(message, session);
        } else if (metodo === 'rolagem_dado') {
            session.caSubEtapa = 'aguardando_dado';
            await pedirDado(message, session);
        } else if (metodo === 'rolagem_dado_atributo') {
            session.caSubEtapa = 'aguardando_dado_com_atributo';
            await pedirDado(message, session);
        }
    });
}

async function pedirValorFixo(message, session) {
    const config = carregarSistemaConfig(session);
    const caNome = config.caNome || 'CA';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🛡️ Passo 10/12 — ${caNome} (Valor Fixo)`)
        .setDescription(`Por favor, digite no chat o **valor numérico fixo** da sua **${caNome}**:`);

    const payload = { embeds: [embed], components: [] };
    await enviarOuEditar(message, payload, session);
}

async function pedirDado(message, session) {
    const config = carregarSistemaConfig(session);
    const caNome = config.caNome || 'CA';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🛡️ Passo 10/12 — ${caNome} (Rolagem de Dado)`)
        .setDescription(
            `A definição da sua **${caNome}** ficará entregue ao destino e à sorte dos dados!\n\n` +
            `🎲 Por favor, informe no chat qual dado você deseja rolar para determinar este valor.\n\n` +
            `💡 *Exemplo:* Digite algo como **1d20**, **2d6** ou **1d10** diretamente aqui no canal.`
        );

    const payload = { embeds: [embed], components: [] };
    await enviarOuEditar(message, payload, session);
}

async function pedirAtributos(message, session) {
    const config = carregarSistemaConfig(session);
    const caNome = config.caNome || 'CA';
    const dadoInfo = session.caData.dadoRolado;

    let atributosDisponiveis = [];
    if (config.atributosConfig && Array.isArray(config.atributosConfig)) {
        atributosDisponiveis = config.atributosConfig;
    } else if (session.data.atributosValores) {
        atributosDisponiveis = Object.keys(session.data.atributosValores).map(nome => ({ nome }));
    } else {
        atributosDisponiveis = [
            { nome: 'Força' }, { nome: 'Destreza' }, { nome: 'Constituição' },
            { nome: 'Inteligência' }, { nome: 'Sabedoria' }, { nome: 'Carisma' }
        ];
    }

    const options = atributosDisponiveis.slice(0, 25).map(attr => ({
        label: attr.nome,
        value: attr.nome
    }));

    let descExtra = '';
    if (dadoInfo) {
        descExtra = `\n-# 🎲 Dado rolado (${dadoInfo.tipo}): **${dadoInfo.resultado}**\n`;
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🛡️ Passo 10/12 — ${caNome} (Atributos)`)
        .setDescription(
            `Selecione abaixo o(s) atributo(s) que deseja vincular à sua **${caNome}** (você pode selecionar mais de um):\n` +
            `${descExtra}`
        );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ca_atributos_select')
        .setPlaceholder('Selecione o(s) atributo(s)...')
        .setMinValues(1)
        .setMaxValues(Math.min(options.length, 25))
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const payload = { embeds: [embed], components: [row] };
    
    const msg = await enviarOuEditar(message, payload, session);
    if (msg) session.botMessage = msg;

    const filter = i => i.user.id === (message.author?.id || message.user?.id);
    const collector = session.botMessage.createMessageComponentCollector({ filter, time: 300000, max: 1 });

    collector.on('collect', async interaction => {
        await interaction.deferUpdate();
        session.caData.atributosSelecionados = interaction.values;
        session.caSubEtapa = 'aguardando_confirmacao_atributos';
        await confirmarAtributos(message, session);
    });
}

async function confirmarAtributos(message, session) {
    const config = carregarSistemaConfig(session);
    const caNome = config.caNome || 'CA';
    const atributos = session.caData.atributosSelecionados.join(', ');
    const dadoInfo = session.caData.dadoRolado;

    let descExtra = '';
    if (dadoInfo) {
        descExtra = `\n-# 🎲 Dado rolado (${dadoInfo.tipo}): **${dadoInfo.resultado}**\n`;
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🛡️ Passo 10/12 — ${caNome} (Confirmação)`)
        .setDescription(
            `Você selecionou o(s) seguinte(s) atributo(s) para a sua **${caNome}**:\n` +
            `• **${atributos}**\n` +
            `${descExtra}\n` +
            `É esses mesmos que você quer adicionar ou deseja escolher novamente?`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ca_conf_sim')
            .setLabel('Sim, confirmar')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('ca_conf_nao')
            .setLabel('Não, escolher novamente')
            .setStyle(ButtonStyle.Danger)
    );

    const payload = { embeds: [embed], components: [row] };
    const msg = await enviarOuEditar(message, payload, session);
    if (msg) session.botMessage = msg;

    const filter = i => i.user.id === (message.author?.id || message.user?.id);
    const collector = session.botMessage.createMessageComponentCollector({ filter, time: 300000, max: 1 });

    collector.on('collect', async interaction => {
        await interaction.deferUpdate();
        if (interaction.customId === 'ca_conf_sim') {
            collector.stop();
            await finalizarCa(message, session);
        } else {
            collector.stop();
            session.caSubEtapa = 'aguardando_atributos';
            await pedirAtributos(message, session);
        }
    });
}

async function processar(message, session) {
    try { await message.delete(); } catch (e) {}
    const config = carregarSistemaConfig(session);
    const caNome = config.caNome || 'CA';
    const subEtapa = session.caSubEtapa;

    if (subEtapa === 'aguardando_valor_fixo') {
        session.caData.valorFixo = message.content.trim();
        await finalizarCa(message, session);
    } 
    else if (subEtapa === 'aguardando_valor_fixo_com_atributo') {
        session.caData.valorFixo = message.content.trim();
        session.caSubEtapa = 'aguardando_atributos';
        await pedirAtributos(message, session);
    } 
    else if (subEtapa === 'aguardando_dado') {
        const tipoDado = message.content.trim().toLowerCase();
        let faces = 20;
        const match = tipoDado.match(/d(\d+)/);
        if (match && match[1]) {
            faces = parseInt(match[1]);
        } else if (!isNaN(tipoDado)) {
            faces = parseInt(tipoDado);
        }

        const resultadoRolagem = Math.floor(Math.random() * faces) + 1;
        session.caData.dadoRolado = { tipo: tipoDado, resultado: resultadoRolagem };

        const embedResultado = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🛡️ Passo 10/12 — ${caNome} (Rolagem Realizada)`)
            .setDescription(
                `Você rolou **${tipoDado}** para a sua **${caNome}**.\n\n` +
                `-# 🎲 Valor obtido no dado: **${resultadoRolagem}**`
            );

        const payload = { embeds: [embedResultado], components: [] };
        await enviarOuEditar(message, payload, session);
        await finalizarCa(message, session);
    } 
    else if (subEtapa === 'aguardando_dado_com_atributo') {
        const tipoDado = message.content.trim().toLowerCase();
        let faces = 20;
        const match = tipoDado.match(/d(\d+)/);
        if (match && match[1]) {
            faces = parseInt(match[1]);
        } else if (!isNaN(tipoDado)) {
            faces = parseInt(tipoDado);
        }

        const resultadoRolagem = Math.floor(Math.random() * faces) + 1;
        session.caData.dadoRolado = { tipo: tipoDado, resultado: resultadoRolagem };

        const embedResultado = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🛡️ Passo 10/12 — ${caNome} (Rolagem Realizada)`)
            .setDescription(
                `Você rolou **${tipoDado}** para a sua **${caNome}**.\n\n` +
                `-# 🎲 Valor obtido no dado: **${resultadoRolagem}**`
            );

        const payload = { embeds: [embedResultado], components: [] };
        await enviarOuEditar(message, payload, session);
        session.caSubEtapa = 'aguardando_atributos';
        await pedirAtributos(message, session);
    } 
    else {
        session.etapaAtual = 'arma_simnao';
        const fichaArma = require('./fichaArma');
        return fichaArma.iniciarSimNao(message, session);
    }
}

async function finalizarCa(message, session) {
    const config = carregarSistemaConfig(session);
    const caNome = config.caNome || 'CA';

    session.data.caInfo = session.caData;
    session.data.caValor = JSON.stringify(session.caData);

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`🛡️ ${caNome} Configurada com Sucesso!`)
        .setDescription(`A regra de cálculo da sua **${caNome}** foi salva com sucesso.`);

    const payload = { embeds: [embed], components: [] };
    await enviarOuEditar(message, payload, session);

    session.etapaAtual = 'arma_simnao';
    const fichaArma = require('./fichaArma');
    return fichaArma.iniciarSimNao(message, session);
}

module.exports = { iniciar, processar };