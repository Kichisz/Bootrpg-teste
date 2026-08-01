const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fichaPv = require('./fichaPv');

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

async function iniciar(target, session) {
    const config = session.sistemaConfig || {};
    if (!config.temPericias) {
        session.etapaAtual = 'pv';
        const fichaPvMod = require('./fichaPv');
        return fichaPvMod.iniciar(target, session);
    }

    const periciasLista = config.periciasLista || config.pericias || config.periciasDisponiveis || [];
    
    if (periciasLista.length === 0) {
        session.etapaAtual = 'pv';
        const fichaPvMod = require('./fichaPv');
        return fichaPvMod.iniciar(target, session);
    }

    session.etapaAtual = 'pericias';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎯 Passo 6/12 — Seleção de Perícias')
        .setDescription(
            'As perícias definem áreas de especialização do seu personagem.\n\n' +
            '👇 **Selecione abaixo as perícias desejadas** (você pode marcar mais de uma opção no menu):'
        );

    const opcoes = periciasLista.slice(0, 25).map(p => {
        const nomePericia = typeof p === 'string' ? p : (p.nome || 'Perícia');
        return new StringSelectMenuOptionBuilder()
            .setLabel(nomePericia.substring(0, 100))
            .setDescription(`Selecionar a perícia ${nomePericia}`.substring(0, 100))
            .setValue(nomePericia);
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ficha_pericia_select')
        .setPlaceholder('Selecione as perícias do seu personagem...')
        .setMinValues(1)
        .setMaxValues(Math.min(opcoes.length, 25))
        .addOptions(opcoes);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const payload = { embeds: [embed], components: [row] };
    return await enviarOuEditar(target, payload, session);
}

async function iniciarConfiguracaoDetalhadaPericias(target, session) {
    const config = session.sistemaConfig || {};
    const calculo = config.calculoPericias;
    const escolhidas = session.data.tempPericiasSelecionadas || [];

    if (!calculo || escolhidas.length === 0) {
        const valorBasePericia = config.periciaValorBase || config.valorBasePericia || config.periciasValorBase || 0;
        session.data.periciasPersonagem = escolhidas.map(nome => ({
            nome: nome,
            valor: valorBasePericia
        }));
        delete session.data.tempPericiasSelecionadas;
        session.etapaAtual = 'pv';
        const fichaPvMod = require('./fichaPv');
        return fichaPvMod.iniciar(target, session);
    }

    session.periciaConfigIndexFicha = 0;
    session.data.periciasValoresFicha = {};

    if (calculo === 'fixo') {
        session.aguardandoPericiaValorFixoFicha = true;
        return await proximaPericiaValorFixo(target, session);
    } else if (calculo === 'atrib_mais_graduacao' || calculo === 'atrib_mais_fixo') {
        session.aguardandoPericiaValorFixoFicha = false;
        return await proximaPericiaAtributo(target, session);
    } else {
        session.data.periciasPersonagem = escolhidas.map(nome => ({ nome, valor: 0 }));
        delete session.data.tempPericiasSelecionadas;
        session.etapaAtual = 'pv';
        const fichaPvMod = require('./fichaPv');
        return fichaPvMod.iniciar(target, session);
    }
}

async function proximaPericiaValorFixo(target, session) {
    const escolhidas = session.data.tempPericiasSelecionadas || [];
    
    if (session.periciaConfigIndexFicha >= escolhidas.length) {
        session.data.periciasPersonagem = escolhidas.map(nome => ({
            nome: nome,
            valorFixo: session.data.periciasValoresFicha[nome] || 0
        }));
        delete session.data.tempPericiasSelecionadas;
        delete session.data.periciasValoresFicha;
        session.aguardandoPericiaValorFixoFicha = false;
        session.etapaAtual = 'pv';
        const fichaPvMod = require('./fichaPv');
        return fichaPvMod.iniciar(target, session);
    }

    const periciaAtual = escolhidas[session.periciaConfigIndexFicha];
    session.periciaAtualConfigNome = periciaAtual;

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔢 Valor Fixo para: ' + periciaAtual)
        .setDescription('Qual é o **valor fixo** que o seu personagem possui na perícia **' + periciaAtual + '**?\n\n💬 *Envie apenas o número no chat (Ex: 10 ou 0):*');

    const payload = { embeds: [embed], components: [] };
    return await enviarOuEditar(target, payload, session);
}

async function proximaPericiaAtributo(target, session) {
    const escolhidas = session.data.tempPericiasSelecionadas || [];
    
    if (session.periciaConfigIndexFicha >= escolhidas.length) {
        session.data.periciasPersonagem = escolhidas.map(nome => ({
            nome: nome,
            atributoBase: session.data.periciasValoresFicha[nome] || []
        }));
        delete session.data.tempPericiasSelecionadas;
        delete session.data.periciasValoresFicha;
        session.etapaAtual = 'pv';
        const fichaPvMod = require('./fichaPv');
        return fichaPvMod.iniciar(target, session);
    }

    const periciaAtual = escolhidas[session.periciaConfigIndexFicha];
    session.periciaAtualConfigNome = periciaAtual;
    
    const config = session.sistemaConfig || {};
    const atributosPermitidos = (config.periciasAtributos && config.periciasAtributos[periciaAtual]) 
        ? config.periciasAtributos[periciaAtual] 
        : (config.atributosLista || ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma']);

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔗 Atributo(s) Base para: ' + periciaAtual)
        .setDescription('Selecione abaixo o(s) atributo(s) base vinculado(s) à perícia **' + periciaAtual + '**:\n\n*Você pode selecionar mais de um se necessário.*');

    const options = atributosPermitidos.map(attr => ({
        label: attr.substring(0, 100),
        value: attr
    }));

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ficha_pericia_atrib_escolha')
            .setPlaceholder('Selecione o(s) atributo(s)...')
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 25))
            .addOptions(options)
    );

    const payload = { embeds: [embed], components: [row] };
    return await enviarOuEditar(target, payload, session);
}

async function tratar(interaction, session) {
    if (!interaction.customId || !interaction.customId.startsWith('ficha_pericia_')) {
        return false;
    }

    if (interaction.customId === 'ficha_pericia_select') {
        if (!interaction.isStringSelectMenu()) return false;
        
        await interaction.deferUpdate().catch(() => {});
        
        const selecionadas = interaction.values;
        session.data.tempPericiasSelecionadas = selecionadas;

        const listaNomes = selecionadas.join(', ');
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎯 Confirmação de Perícias')
            .setDescription('Você está prestes a ativar as perícias: **' + listaNomes + '**.\n\nTem certeza?');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ficha_pericia_conf_sim')
                .setLabel('Sim, confirmar')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ficha_pericia_conf_nao')
                .setLabel('Não, escolher novamente')
                .setStyle(ButtonStyle.Danger)
        );

        const payload = { embeds: [embed], components: [row] };
        return await enviarOuEditar(interaction, payload, session);
    }

    if (interaction.customId === 'ficha_pericia_conf_sim') {
        if (!interaction.isButton()) return false;
        
        await interaction.deferUpdate().catch(() => {});
        return await iniciarConfiguracaoDetalhadaPericias(interaction, session);
    }

    if (interaction.customId === 'ficha_pericia_conf_nao') {
        if (!interaction.isButton()) return false;
        
        await interaction.deferUpdate().catch(() => {});
        delete session.data.tempPericiasSelecionadas;

        return iniciar(interaction, session);
    }

    if (interaction.customId === 'ficha_pericia_atrib_escolha') {
        if (!interaction.isStringSelectMenu()) return false;

        await interaction.deferUpdate().catch(() => {});
        
        const atributosEscolhidos = interaction.values;
        session.data.tempAtributosPericia = atributosEscolhidos;
        const periciaAtual = session.periciaAtualConfigNome;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🔗 Confirmação de Atributos')
            .setDescription('Você está prestes a vincular **' + atributosEscolhidos.join(', ') + '** na perícia **' + periciaAtual + '**, deseja mesmo fazer isso?');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ficha_pericia_atrib_conf_sim')
                .setLabel('Sim')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ficha_pericia_atrib_conf_nao')
                .setLabel('Não')
                .setStyle(ButtonStyle.Danger)
        );

        const payload = { embeds: [embed], components: [row] };
        return await enviarOuEditar(interaction, payload, session);
    }

    if (interaction.customId === 'ficha_pericia_atrib_conf_sim') {
        if (!interaction.isButton()) return false;

        await interaction.deferUpdate().catch(() => {});

        const periciaAtual = session.periciaAtualConfigNome;
        const atributosEscolhidos = session.data.tempAtributosPericia || [];

        if (!session.data.periciasValoresFicha) {
            session.data.periciasValoresFicha = {};
        }

        session.data.periciasValoresFicha[periciaAtual] = atributosEscolhidos;
        delete session.data.tempAtributosPericia;
        session.periciaConfigIndexFicha++;

        return await proximaPericiaAtributo(interaction, session);
    }

    if (interaction.customId === 'ficha_pericia_atrib_conf_nao') {
        if (!interaction.isButton()) return false;

        await interaction.deferUpdate().catch(() => {});
        delete session.data.tempAtributosPericia;

        return await proximaPericiaAtributo(interaction, session);
    }

    return false;
}

async function processar(message, session) {
    if (session.aguardandoPericiaValorFixoFicha) {
        try { await message.delete(); } catch (e) {}

        const texto = message.content.trim();
        const periciaAtual = session.periciaAtualConfigNome;

        if (!session.data.periciasValoresFicha) {
            session.data.periciasValoresFicha = {};
        }

        session.data.periciasValoresFicha[periciaAtual] = texto;
        session.periciaConfigIndexFicha++;

        return await proximaPericiaValorFixo(message, session);
    }

    try { await message.delete(); } catch (e) {}
    return message.channel.send({ content: '⚠️ Por favor, utilize o menu interativo acima para selecionar as suas perícias.', ephemeral: true }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 4000);
    });
}

module.exports = { iniciar, tratar, processar };