const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
    
    if (config.temPv === false) {
        session.etapaAtual = 'pm';
        const fichaPmMod = require('./fichaPm');
        return fichaPmMod.iniciar(target, session);
    }

    session.etapaAtual = 'pv';
    const pvCalculo = config.pvCalculo || config.tipoPv || 'fixo';
    session.data.pvConfig = { tipoCalculo: pvCalculo };

    return prosseguirEtapaPv(target, session);
}

async function prosseguirEtapaPv(target, session) {
    const config = session.sistemaConfig || {};
    const calculo = session.data.pvConfig.tipoCalculo;

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('❤️ Passo 7/12 — Pontos de Vida (PV)');

    let row = null;

    if (calculo.includes('dado') || calculo.includes('roll')) {
        session.aguardandoPvDado = true;
        session.aguardandoPvFixo = false;
        session.aguardandoPvBase = false;

        embed.setDescription(
            'O PV do seu personagem é determinado através de rolagem de dados.\n\n' +
            '💬 **Envie no chat o formato do dado** para o PV (Ex: `1d10`, `2d6`):'
        );
    } 
    else if (calculo.includes('base') || calculo.includes('atrib')) {
        if (!session.data.pvConfig.baseInformada) {
            session.aguardandoPvBase = true;
            session.aguardandoPvFixo = false;
            session.aguardandoPvDado = false;

            embed.setDescription(
                'O PV do seu personagem é calculado por um valor base somado a atributos.\n\n' +
                '💬 **Envie no chat o valor base de PV** definido pelo sistema (Ex: `10`, `20`):'
            );
        } else {
            session.aguardandoPvBase = false;
            session.aguardandoPvFixo = false;
            session.aguardandoPvDado = false;

            embed.setDescription(
                `Base de PV definida: **${session.data.pvConfig.baseValor}**.\n\n` +
                '🔗 **Selecione abaixo o(s) atributo(s)** que somam no cálculo do seu PV *(você pode selecionar mais de um)*:'
            );

            const atributosPermitidos = config.atributosLista || ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
            const options = atributosPermitidos.map(attr => ({
                label: attr.substring(0, 100),
                value: attr
            }));

            row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ficha_pv_atrib_escolha')
                    .setPlaceholder('Selecione o(s) atributo(s)...')
                    .setMinValues(1)
                    .setMaxValues(Math.min(options.length, 25))
                    .addOptions(options)
            );
        }
    } 
    else {
        session.aguardandoPvFixo = true;
        session.aguardandoPvBase = false;
        session.aguardandoPvDado = false;

        embed.setDescription(
            'O PV representa a integridade física e a capacidade de suportar dano antes de cair.\n\n' +
            '💬 **Envie no chat o valor inicial total para o seu PV** (Ex: `50`, `100`):'
        );
    }

    const payload = { embeds: [embed], components: row ? [row] : [] };
    return await enviarOuEditar(target, payload, session);
}

async function tratar(interaction, session) {
    if (!interaction.customId || !interaction.customId.startsWith('ficha_pv_')) {
        return false;
    }

    if (interaction.customId === 'ficha_pv_atrib_escolha') {
        if (!interaction.isStringSelectMenu()) return false;

        const atributosEscolhidos = interaction.values;
        session.data.tempPvAtributos = atributosEscolhidos;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('❤️ Confirmação de Atributos de PV')
            .setDescription(`Você está prestes a vincular **${atributosEscolhidos.join(', ')}** no cálculo do seu PV, deseja mesmo fazer isso?`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ficha_pv_atrib_conf_sim')
                .setLabel('Sim')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ficha_pv_atrib_conf_nao')
                .setLabel('Não')
                .setStyle(ButtonStyle.Danger)
        );

        const payload = { embeds: [embed], components: [row] };
        return await enviarOuEditar(interaction, payload, session);
    }

    if (interaction.customId === 'ficha_pv_atrib_conf_sim') {
        if (!interaction.isButton()) return false;

        await interaction.deferUpdate().catch(() => {});

        session.data.pvConfig.atributosVinculados = session.data.tempPvAtributos || [];
        delete session.data.tempPvAtributos;

        session.etapaAtual = 'pm';
        const fichaPmMod = require('./fichaPm');
        return fichaPmMod.iniciar(interaction, session);
    }

    if (interaction.customId === 'ficha_pv_atrib_conf_nao') {
        if (!interaction.isButton()) return false;

        await interaction.deferUpdate().catch(() => {});

        delete session.data.tempPvAtributos;
        return await prosseguirEtapaPv(interaction, session);
    }

    return false;
}

async function processar(message, session) {
    try { await message.delete(); } catch (e) {}

    const texto = message.content.trim();

    if (session.aguardandoPvFixo) {
        session.data.pvFinal = parseInt(texto) || texto;
        session.aguardandoPvFixo = false;
        
        session.etapaAtual = 'pm';
        const fichaPmMod = require('./fichaPm');
        return fichaPmMod.iniciar(message, session);
    }

    if (session.aguardandoPvBase) {
        session.data.pvConfig.baseValor = parseInt(texto) || texto;
        session.data.pvConfig.baseInformada = true;
        session.aguardandoPvBase = false;
        return prosseguirEtapaPv(message, session);
    }

    if (session.aguardandoPvDado) {
        session.aguardandoPvDado = false;
        session.data.pvConfig.expressaoDado = texto;

        const match = texto.toLowerCase().match(/^(\d*)d(\d+)([\+\-]\d+)?$/);
        
        let totalRolagem = 0;
        let resultadosIndividuais = [];

        if (match) {
            const quantidade = parseInt(match[1]) || 1;
            const faces = parseInt(match[2]);
            const modificadorFixo = parseInt(match[3]) || 0;

            for (let i = 0; i < quantidade; i++) {
                const r = Math.floor(Math.random() * faces) + 1;
                resultadosIndividuais.push(r);
                totalRolagem += r;
            }
            totalRolagem += modificadorFixo;

            session.data.pvConfig.resultadoRolagemDado = totalRolagem;
        } else {
            totalRolagem = parseInt(texto) || 10;
            resultadosIndividuais = [totalRolagem];
            session.data.pvConfig.resultadoRolagemDado = totalRolagem;
        }

        const calculo = session.data.pvConfig.tipoCalculo;
        if (calculo.includes('atrib') || calculo.includes('mais')) {
            session.data.pvConfig.dadoRoladoDetalhes = resultadosIndividuais;
            
            const config = session.sistemaConfig || {};
            const atributosPermitidos = config.atributosLista || ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
            
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('❤️ Atributo para somar ao PV')
                .setDescription(
                    `🎲 *Nos dados caíram **${resultadosIndividuais.join(', ')}**, totalizando **${totalRolagem}** nos dados.*\n\n` +
                    '🔗 **Selecione abaixo o(s) atributo(s)** que somam junto com o seu PV:'
                );

            const options = atributosPermitidos.map(attr => ({
                label: attr.substring(0, 100),
                value: attr
            }));

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ficha_pv_atrib_escolha')
                    .setPlaceholder('Selecione o(s) atributo(s)...')
                    .setMinValues(1)
                    .setMaxValues(Math.min(options.length, 25))
                    .addOptions(options)
            );

            const payload = { embeds: [embed], components: [row] };
            return await enviarOuEditar(message, payload, session);
        } else {
            session.data.pvFinal = totalRolagem;
            
            const embedAviso = await message.channel.send({
                content: `🎲 *Nos dados do PV (${texto}) caíram: **${resultadosIndividuais.join(', ')}** (Total: **${totalRolagem}**)*`
            });
            setTimeout(() => embedAviso.delete().catch(() => {}), 6000);

            session.etapaAtual = 'pm';
            const fichaPmMod = require('./fichaPm');
            return fichaPmMod.iniciar(message, session);
        }
    }

    return false;
}

module.exports = {
    iniciar,
    tratar,
    processar
};