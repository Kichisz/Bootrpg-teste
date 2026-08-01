const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

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
    const config = session.sistemaConfig;
    if (!config.temAtributos || !config.atributosLista || config.atributosLista.length === 0) {
        session.etapaAtual = 'pericias';
        const fichaPericias = require('./fichaPericias');
        return fichaPericias.iniciar(target, session);
    }

    session.atributosListaFicha = config.atributosLista;
    session.atributoIndiceAtual = 0;
    session.data.atributosValores = {};

    return perguntarAtributo(target, session);
}

async function perguntarAtributo(target, session) {
    if (session.atributoIndiceAtual >= session.atributosListaFicha.length) {
        session.etapaAtual = 'pericias';
        const fichaPericias = require('./fichaPericias');
        return fichaPericias.iniciar(target, session);
    }

    const attrNome = session.atributosListaFicha[session.atributoIndiceAtual];
    session.atributoAtualNome = attrNome;

    const config = session.sistemaConfig || {};
    
    const tipo = (config.tipoAtributos || config.tipoAtributo || 'numero').toLowerCase();
    const atribBase = config.atribBase || 10;
    const atribPasso = config.atribPasso || 2;
    const maxVal = config.maxAtributo || config.limiteAtributo || config.maxBolinhas || 5;

    let descExplicao = '';
    let row = null;

    if (tipo.includes('bolinha') || tipo.includes('dot')) {
        descExplicao = 
            `🌟 **Sistema de Atributos por Bolinhas**\n` +
            `Neste sistema, o valor do seu atributo é representado visualmente por pontos preenchidos.\n\n` +
            `• O limite máximo para este atributo é de **${maxVal}** bolinhas.\n` +
            `• Cada bolinha preenchida (**●**) eleva o seu nível de poder.\n\n` +
            `👇 **Selecione abaixo a quantidade de bolinhas desejada para ${attrNome}:**`;

        const options = [];
        for (let i = 1; i <= maxVal; i++) {
            const preenchidas = '●'.repeat(i);
            const vazias = '○'.repeat(maxVal - i);
            options.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Nível ${i} — ${preenchidas}${vazias}`)
                    .setDescription(`Definir ${attrNome} com ${i} bolinha(s)`)
                    .setValue(String(i))
            );
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`ficha_attr_select_${attrNome}`)
            .setPlaceholder(`Selecione as bolinhas para ${attrNome}...`)
            .addOptions(options);

        row = new ActionRowBuilder().addComponents(selectMenu);

    } else if (tipo === 'numero' || tipo.includes('modificador') || tipo.includes('mod')) {
        descExplicao = 
            `⚙️ **Sistema de Atributo com Modificadores**\n` +
            `Neste sistema, você define o valor numérico bruto do atributo.\n\n` +
            `• **Valor Base:** O valor neutro de referência é **${atribBase}** (que equivale a modificador 0).\n` +
            `• **Regra de Passo:** A cada **${atribPasso} pontos** acima desse número equivale a **+1** (ou a cada **${atribPasso} pontos** abaixo equivale a **-1**).\n\n` +
            `💬 **Envie no chat** o valor numérico desejado para **${attrNome}**:`;

    } else if (tipo.includes('porcentagem') || tipo.includes('%')) {
        descExplicao = 
            `📊 **Sistema de Atributo Percentual (%)**\n` +
            `Neste sistema, os atributos utilizam uma escala de porcentagem direta.\n\n` +
            `💬 **Envie no chat** o valor percentual desejado para **${attrNome}** (ex: 50):`;

    } else {
        descExplicao = 
            `🔢 **Sistema de Atributo Numérico Direto**\n` +
            `Neste sistema, os atributos utilizam valores inteiros diretos.\n\n` +
            `💬 **Envie no chat** o valor numérico desejado para **${attrNome}**:`;
    }

    const passoAtualNum = 5 + session.atributoIndiceAtual;
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`💪 Passo ${passoAtualNum}/12 — Atributo: ${attrNome}`)
        .setDescription(descExplicao);

    const payload = { embeds: [embed], components: row ? [row] : [] };
    return await enviarOuEditar(target, payload, session);
}

async function tratar(interaction, session) {
    if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('ficha_attr_select_')) {
        return false;
    }

    await interaction.deferUpdate().catch(() => {});

    const valor = interaction.values[0];
    session.data.atributosValores[session.atributoAtualNome] = valor;
    session.atributoIndiceAtual++;

    return perguntarAtributo(interaction, session);
}

async function processar(message, session) {
    try { await message.delete(); } catch (e) {}
    const texto = message.content.trim();
    session.data.atributosValores[session.atributoAtualNome] = texto;
    session.atributoIndiceAtual++;

    return perguntarAtributo(message, session);
}

module.exports = { 
    iniciar, 
    processar, 
    tratar 
};