const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const sessionManager = require('./sessionManager');
const recursosHandler = require('./recursos');

async function editarMensagemUnica(channelOrInteraction, session, embed, row = null) {
    try {
        let msg = null;
        if (session.lastInteraction && typeof session.lastInteraction.editReply === 'function') {
            msg = await session.lastInteraction.editReply({ embeds: [embed], components: row ? [row] : [] }).catch(() => null);
        }

        if (!msg) {
            if (channelOrInteraction.isStringSelectMenu && channelOrInteraction.isStringSelectMenu()) {
                if (channelOrInteraction.deferred || channelOrInteraction.replied) {
                    msg = await channelOrInteraction.editReply({ embeds: [embed], components: row ? [row] : [] });
                } else {
                    await channelOrInteraction.deferUpdate().catch(() => {});
                    msg = await channelOrInteraction.editReply({ embeds: [embed], components: row ? [row] : [] });
                }
            } else if (typeof channelOrInteraction.editReply === 'function') {
                msg = await channelOrInteraction.editReply({ embeds: [embed], components: row ? [row] : [] });
            } else {
                const channel = channelOrInteraction.channel || channelOrInteraction;
                msg = await channel.send({ embeds: [embed], components: row ? [row] : [] });
            }
        }

        if (msg) {
            sessionManager.salvarMensagemAtual(session, msg);
        }
        return msg;
    } catch (err) {
        console.error('Erro ao editar mensagem em xp.js:', err);
    }
}

async function iniciarXp(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⭐ Curva de Progressão de XP / Nível')
        .setDescription('O sistema utiliza experiência (XP) para evolução dos personagens?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_tem_xp')
            .setPlaceholder('O sistema possui XP/Nível?')
            .addOptions([
                { label: 'Sim, usamos apenas XP', value: 'so_xp' },
                { label: 'Sim, usamos XP e Nível', value: 'xp_e_nivel' },
                { label: 'Não utilizamos XP nem nível', value: 'nao' }
            ])
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

async function perguntarGanhoPontosUpar(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎁 Pontos ao Upar de Nível')
        .setDescription('Os players ganharão pontos de perícia ou atributos ao upar de nível?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_ganho_pontos')
            .setPlaceholder('Escolha a opção de ganho...')
            .addOptions([
                { label: 'Ganhara pontos de Atributo', value: 'atributo' },
                { label: 'Ganhara pontos de Pericia', value: 'pericia' },
                { label: 'Ganhara pontos de Atributo e Pericia', value: 'ambos' },
                { label: 'Não ganhara pontos em nenhum', value: 'nenhum' }
            ])
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

async function tratarInteracao(interaction) {
    const session = sessionManager.getSession(interaction.user.id);
    if (!session) return false;

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_tem_xp') {
        const valor = interaction.values[0];
        session.data.tipoXpOpcao = valor;
        const tem = valor !== 'nao';
        session.data.temXp = tem;

        // Se selecionou "Não utilizamos XP nem nível" ou "Sim, usamos apenas XP", pula a curva de progressão de nível
        if (!tem || valor === 'so_xp') {
            return await recursosHandler.iniciarRecursos(interaction, session);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📈 Curva de Progressão de XP')
            .setDescription('Como funciona a curva de progressão e ganho de níveis?');

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('rpg_setup_xp_curva')
                .setPlaceholder('Escolha a curva de XP...')
                .addOptions([
                    { label: 'Linear (mesma quantidade de XP por nível)', value: 'linear' },
                    { label: 'Exponencial Manual (digitar a lista por nível)', value: 'exponencial' },
                    { label: 'Multiplicador (gerar por base e fator)', value: 'multiplicador' }
                ])
        );

        await editarMensagemUnica(interaction, session, embed, row);
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_xp_curva') {
        const curva = interaction.values[0];
        session.data.curvaXp = curva;

        if (curva === 'linear') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📈 Meta de XP Linear')
                .setDescription('Qual a **quantia de XP** que quer que os jogadores alcancem pra ir pro próximo nível? Envie apenas o número no chat (Ex: `200`).');

            await editarMensagemUnica(interaction, session, embed, null);
            sessionManager.resetarFlagsTexto(session);
            session.waitingForXpLinear = true;
            return true;
        }

        if (curva === 'exponencial') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📈 Aumento Exponencial Manual')
                .setDescription('⚠️ **ATENÇÃO:** Envie em **ordem estrita** (Ex: `1:300, 2:400, 3:800`).\n\n*Nota:* Se você fizer apenas até o nível 10, o seu sistema só poderá chegar até o nível 10. Não pule níveis ou inverta a ordem (ex: nada de `1:200 4:500 3:2380`). Envie a lista no chat:');

            await editarMensagemUnica(interaction, session, embed, null);
            sessionManager.resetarFlagsTexto(session);
            session.waitingForXpExponencialManual = true;
            return true;
        }

        if (curva === 'multiplicador') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('✖️ Valor Base para Multiplicador')
                .setDescription('Qual o **valor base** inicial para upar de nível? Envie apenas o número no chat (Ex: `200`):');

            await editarMensagemUnica(interaction, session, embed, null);
            sessionManager.resetarFlagsTexto(session);
            session.waitingForXpBaseMultiplicador = true;
            return true;
        }

        if (session.data.tipoXpOpcao === 'xp_e_nivel') {
            return await perguntarGanhoPontosUpar(interaction, session);
        }

        return await recursosHandler.iniciarRecursos(interaction, session);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_xp_tipo_multiplicador') {
        const tipoMultiplicador = interaction.values[0];
        const base = parseFloat(session.data.xpBaseMultiplicador) || 200;
        const fator = parseFloat(session.data.xpFatorMultiplicador) || 2;
        const maxNiveis = parseInt(session.data.xpMaxNiveisMultiplicador) || 10;

        let listaFinal = [];
        let acumulado = base;
        for (let lvl = 2; lvl <= maxNiveis; lvl++) {
            if (tipoMultiplicador === 'atual') {
                if (lvl === 2) acumulado = base;
                else acumulado = acumulado * fator;
            } else {
                acumulado = base * (lvl - 1);
            }
            listaFinal.push(`${lvl}:${Math.round(acumulado)}`);
        }

        session.data.xpExponencialConfig = listaFinal.join(', ');
        session.data.nivelMaximo = maxNiveis;

        const embedResumo = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Progressão Calculada com Sucesso!')
            .setDescription(`Configuração gerada:\n\`${session.data.xpExponencialConfig}\`\n\n**Nível Máximo Definido:** ${maxNiveis}`);

        await editarMensagemUnica(interaction, session, embedResumo, null);

        setTimeout(async () => {
            if (session.data.tipoXpOpcao === 'xp_e_nivel') {
                await perguntarGanhoPontosUpar(interaction, session);
            } else {
                await recursosHandler.iniciarRecursos(interaction, session);
            }
        }, 2000);

        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_ganho_pontos') {
        const escolha = interaction.values[0];
        session.data.ganhoPontosOpcao = escolha;

        if (escolha === 'atributo') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('💪 Frequência de Pontos de Atributo')
                .setDescription('A cada quantos níveis o player ganhará pontos de atributo? Envie apenas o número no chat (Ex: `4`).');
            await editarMensagemUnica(interaction, session, embed, null);
            sessionManager.resetarFlagsTexto(session);
            session.waitingForAtribNiveisFreq = true;
            return true;
        }

        if (escolha === 'pericia') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎯 Frequência de Pontos de Perícia')
                .setDescription('A cada quantos níveis o player ganhará pontos de perícia? Envie apenas o número no chat (Ex: `2`).');
            await editarMensagemUnica(interaction, session, embed, null);
            sessionManager.resetarFlagsTexto(session);
            session.waitingForPericiaNiveisFreq = true;
            return true;
        }

        if (escolha === 'ambos') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('💪 Frequência de Pontos de Atributo')
                .setDescription('A cada quantos níveis o player ganhará pontos de atributo? Envie apenas o número no chat (Ex: `4`).');
            await editarMensagemUnica(interaction, session, embed, null);
            sessionManager.resetarFlagsTexto(session);
            session.waitingForAmbosAtribNiveisFreq = true;
            return true;
        }

        return await recursosHandler.iniciarRecursos(interaction, session);
    }

    return false;
}

async function processarXpTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    if (session.waitingForXpLinear) {
        session.waitingForXpLinear = false;
        session.data.xpLinearMeta = texto;

        if (session.data.tipoXpOpcao === 'xp_e_nivel') {
            return await perguntarGanhoPontosUpar(message, session);
        }

        return await recursosHandler.iniciarRecursos(message, session);
    }

    if (session.waitingForXpExponencialManual) {
        session.waitingForXpExponencialManual = false;
        session.data.xpExponencialConfig = texto;

        let maiorNivel = 10;
        const matches = [...texto.matchAll(/(\d+)\s*:/g)];
        if (matches.length > 0) {
            const niveisEncontrados = matches.map(m => parseInt(m[1]));
            maiorNivel = Math.max(...niveisEncontrados);
        }
        session.data.nivelMaximo = maiorNivel;

        const confirmEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Progressão Salva!')
            .setDescription(`Lista salva com sucesso!\n**Nível Máximo Detectado:** ${maiorNivel}`);

        await editarMensagemUnica(message, session, confirmEmbed, null);

        setTimeout(async () => {
            if (session.data.tipoXpOpcao === 'xp_e_nivel') {
                await perguntarGanhoPontosUpar(message, session);
            } else {
                await recursosHandler.iniciarRecursos(message, session);
            }
        }, 2000);

        return true;
    }

    if (session.waitingForXpBaseMultiplicador) {
        session.waitingForXpBaseMultiplicador = false;
        session.data.xpBaseMultiplicador = texto;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('✖️ Fator Multiplicador')
            .setDescription('Qual o **multiplicador** que irá multiplicar o valor a cada level up? Envie apenas o número (Ex: `2`):');

        await editarMensagemUnica(message, session, embed, null);
        session.waitingForXpFatorMultiplicador = true;
        return true;
    }

    if (session.waitingForXpFatorMultiplicador) {
        session.waitingForXpFatorMultiplicador = false;
        session.data.xpFatorMultiplicador = texto;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📊 Nível Máximo do Sistema')
            .setDescription('Até qual **nível máximo** esse sistema poderá chegar usando este multiplicador? Envie apenas o número (Ex: `10`):');

        await editarMensagemUnica(message, session, embed, null);
        session.waitingForXpMaxNiveisMultiplicador = true;
        return true;
    }

    if (session.waitingForXpMaxNiveisMultiplicador) {
        session.waitingForXpMaxNiveisMultiplicador = false;
        session.data.xpMaxNiveisMultiplicador = texto;

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('rpg_setup_xp_tipo_multiplicador')
                .setPlaceholder('Escolha a regra do multiplicador...')
                .addOptions([
                    { label: 'Multiplicar o valor Atual', value: 'atual' },
                    { label: 'Multiplicar o valor Inicial', value: 'inicial' }
                ])
        );

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚙️ Regra de Multiplicação')
            .setDescription('O multiplicador irá multiplicar o **valor atual** ou o **valor inicial** a cada nível?');

        await editarMensagemUnica(message, session, embed, row);
        return true;
    }

    if (session.waitingForAtribNiveisFreq) {
        session.waitingForAtribNiveisFreq = false;
        session.data.atribNiveisFreq = texto;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('💪 Quantidade de Pontos de Atributo')
            .setDescription('Quantos pontos de atributo o player ganha ao alcançar esse marco de níveis? Envie apenas o número no chat (Ex: `5`).');
        await editarMensagemUnica(message, session, embed, null);
        session.waitingForAtribPontosQtd = true;
        return true;
    }

    if (session.waitingForAtribPontosQtd) {
        session.waitingForAtribPontosQtd = false;
        session.data.atribPontosQtd = texto;
        return await recursosHandler.iniciarRecursos(message, session);
    }

    if (session.waitingForPericiaNiveisFreq) {
        session.waitingForPericiaNiveisFreq = false;
        session.data.periciaNiveisFreq = texto;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎯 Quantidade de Pontos de Perícia')
            .setDescription('Quantos pontos de perícia o player ganha ao alcançar esse marco de níveis? Envie apenas o número no chat (Ex: `3`).');
        await editarMensagemUnica(message, session, embed, null);
        session.waitingForPericiaPontosQtd = true;
        return true;
    }

    if (session.waitingForPericiaPontosQtd) {
        session.waitingForPericiaPontosQtd = false;
        session.data.periciaPontosQtd = texto;
        return await recursosHandler.iniciarRecursos(message, session);
    }

    if (session.waitingForAmbosAtribNiveisFreq) {
        session.waitingForAmbosAtribNiveisFreq = false;
        session.data.atribNiveisFreq = texto;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('💪 Quantidade de Pontos de Atributo')
            .setDescription('Quantos pontos de atributo o player ganha ao alcançar esse marco de níveis? Envie apenas o número no chat.');
        await editarMensagemUnica(message, session, embed, null);
        session.waitingForAmbosAtribPontosQtd = true;
        return true;
    }

    if (session.waitingForAmbosAtribPontosQtd) {
        session.waitingForAmbosAtribPontosQtd = false;
        session.data.atribPontosQtd = texto;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎯 Frequência de Pontos de Perícia')
            .setDescription('A cada quantos níveis o player ganhará pontos de perícia? Envie apenas o número no chat.');
        await editarMensagemUnica(message, session, embed, null);
        session.waitingForAmbosPericiaNiveisFreq = true;
        return true;
    }

    if (session.waitingForAmbosPericiaNiveisFreq) {
        session.waitingForAmbosPericiaNiveisFreq = false;
        session.data.periciaNiveisFreq = texto;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎯 Quantidade de Pontos de Perícia')
            .setDescription('Quantos pontos de perícia o player ganha ao alcançar esse marco de níveis? Envie apenas o número no chat.');
        await editarMensagemUnica(message, session, embed, null);
        session.waitingForAmbosPericiaPontosQtd = true;
        return true;
    }

    if (session.waitingForAmbosPericiaPontosQtd) {
        session.waitingForAmbosPericiaPontosQtd = false;
        session.data.periciaPontosQtd = texto;
        return await recursosHandler.iniciarRecursos(message, session);
    }

    return false;
}

module.exports = {
    iniciarXp,
    tratarInteracao,
    processarXpTexto
};