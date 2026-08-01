const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const sessionManager = require('./sessionManager');
const xpHandler = require('./xp');

function capitalizar(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function editarMensagemUnica(channelOrInteraction, session, embed, row = null) {
    try {
        let msg = null;
        const payload = { embeds: [embed], components: row ? [row] : [] };

        if (channelOrInteraction && typeof channelOrInteraction.update === 'function') {
            if (!channelOrInteraction.deferred && !channelOrInteraction.replied) {
                msg = await channelOrInteraction.update({ ...payload, fetchReply: true }).catch(() => null);
            } else {
                msg = await channelOrInteraction.editReply(payload).catch(() => null);
            }
        }

        if (!msg && session.lastInteraction && typeof session.lastInteraction.editReply === 'function') {
            msg = await session.lastInteraction.editReply(payload).catch(() => null);
        }

        if (!msg && channelOrInteraction && typeof channelOrInteraction.editReply === 'function') {
            msg = await channelOrInteraction.editReply(payload).catch(() => null);
        }

        // GARANTIA DE PRIVACIDADE: Usa followUp efêmero caso precise recriar
        if (!msg && session.lastInteraction && typeof session.lastInteraction.followUp === 'function') {
            msg = await session.lastInteraction.followUp({ ...payload, ephemeral: true }).catch(() => null);
        }

        if (msg) {
            sessionManager.salvarMensagemAtual(session, msg);
        }
        return msg;
    } catch (err) {
        console.error('Erro ao editar mensagem em pericias.js:', err);
    }
}

async function iniciarPericiasSimNao(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎯 Sistema de Perícias')
        .setDescription('O seu sistema possui perícias ou testes especializados de proficiência?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_tem_pericias')
            .setPlaceholder('O sistema possui perícias?')
            .addOptions([
                { label: 'Sim, possui perícias', value: 'sim' },
                { label: 'Não utilizamos perícias', value: 'nao' }
            ])
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

async function perguntarCalculoPericias(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Cálculo de Perícias nos Testes')
        .setDescription('Como as perícias são calculadas nos testes?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_pericias_calculo')
            .setPlaceholder('Escolha a forma de cálculo...')
            .addOptions([
                { label: 'atributo + graduação = valor da pericia', value: 'atrib_mais_graduacao' },
                { label: 'Apenas valor fixo da perícia', value: 'fixo' },
                { label: 'atributo + valor fixo = valor da pericia', value: 'atrib_mais_fixo' }
            ])
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

async function iniciarPericiasCategoriaSimNao(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🏷️ Categorias de Perícias')
        .setDescription('Deseja agrupar as perícias por categoria nas fichas?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_pericia_cat_simnao')
            .setPlaceholder('Agrupar perícias por categoria?')
            .addOptions([
                { label: 'Sim', value: 'sim' },
                { label: 'Não', value: 'nao' }
            ])
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

async function perguntarPericiaCategoria(channelOrInteraction, session) {
    if (!session.data.periciaCatConfig) {
        session.data.periciaCatConfig = {};
    }

    if (session.periciaCatIndex >= session.data.periciasLista.length) {
        return await xpHandler.iniciarXp(channelOrInteraction, session);
    }

    const periciaAtual = session.data.periciasLista[session.periciaCatIndex];

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🏷️ Categoria da Perícia')
        .setDescription(`Qual categoria devemos colocar a perícia **${periciaAtual}**?`);

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_pericia_cat_escolha')
            .setPlaceholder('Selecione a categoria...')
            .addOptions(
                session.data.periciaCatLista.map(cat => ({
                    label: cat.substring(0, 100),
                    value: cat
                }))
            )
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

async function receberPericiaCatNomes(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    session.data.periciaCatLista = texto.split(',').map(s => capitalizar(s.trim())).filter(Boolean);
    session.waitingForPericiaCatNomes = false;
    session.periciaCatIndex = 0;
    session.data.periciaCatConfig = {};

    return await perguntarPericiaCategoria(message, session);
}

async function tratarInteracao(interaction) {
    const session = sessionManager.getSession(interaction.user.id);
    if (!session) return false;

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_tem_pericias') {
        const tem = interaction.values[0] === 'sim';
        session.data.temPericias = tem;

        if (!tem) {
            return await xpHandler.iniciarXp(interaction, session);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎯 Nome das Perícias')
            .setDescription('Qual é o **nome das perícias** que o seu sistema usa? Envie no chat a lista com os nomes separados por vírgula.');

        await editarMensagemUnica(interaction, session, embed, null);
        sessionManager.resetarFlagsTexto(session);
        session.waitingForPericiasNome = true;
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_pericias_tipo') {
        const tipo = interaction.values[0];
        session.data.tipoPericias = tipo;

        if (tipo === 'bolinhas') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🔵 Máximo de Bolinhas nas Perícias')
                .setDescription('Qual é o **máximo que um jogador pode ter** nas perícias em formato de bolinhas? (Ex: `5`). Envie apenas o número no chat.');
            
            await editarMensagemUnica(interaction, session, embed, null);
            sessionManager.resetarFlagsTexto(session);
            session.waitingForPericiasBolinhasMax = true;
            return true;
        }

        if (tipo === 'escala') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 Escala Numérica de Perícias')
                .setDescription('Qual é o **valor máximo** que uma perícia pode atingir na escala? Envie apenas o número no chat (Ex: `5`).');
            
            await editarMensagemUnica(interaction, session, embed, null);
            sessionManager.resetarFlagsTexto(session);
            session.waitingForPericiasEscalaMax = true;
            return true;
        }

        return await perguntarCalculoPericias(interaction, session);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_pericias_calculo') {
        session.data.calculoPericias = interaction.values[0];

        if (session.data.calculoPericias === 'atrib_mais_graduacao') {
            sessionManager.resetarFlagsTexto(session);
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📈 Graduação: Progressão por Nível')
                .setDescription(
                    'Toda vez que o personagem upar de nível, o sistema de graduação aumenta?\n\n' +
                    '💡 *Exemplo (Estilo D&D): A cada 4 níveis sua graduação aumenta em +1. Se tem Acrobacia e +2 Destreza no Nível 1: `2 (graduação) + 2 (atributo) = 4`. No Nível 5 fica `3 (graduação) + 2 (atributo)`, no Nível 9 fica `4 (graduação) + 2` e assim por diante.*'
                );
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('rpg_setup_grad_upar_nivel')
                    .setPlaceholder('A graduação aumenta com o nível?')
                    .addOptions([
                        { label: 'Sim (Aumenta com nível)', value: 'sim' },
                        { label: 'Não (Graduação Fixa)', value: 'nao' }
                    ])
            );
            await editarMensagemUnica(interaction, session, embed, row);
            return true;
        }

        return await iniciarPericiasCategoriaSimNao(interaction, session);
    }

    // Nova interação para Graduação Sim/Não
    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_grad_upar_nivel') {
        const aumentaComNivel = interaction.values[0] === 'sim';
        session.data.graduacaoAumentaComNivel = aumentaComNivel;
        sessionManager.resetarFlagsTexto(session);

        if (!aumentaComNivel) {
            session.waitingForGradValorFixo = true;
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🛠️ Graduação Fixa')
                .setDescription('Qual é o valor fixo da graduação nas perícias treinadas? (Ex: `+1`, `+2`, `+3`)\n\n*Envie apenas o número/valor no chat:*');
            await editarMensagemUnica(interaction, session, embed, null);
            return true;
        } else {
            session.waitingForGradBase = true;
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🛠️ Graduação Dinâmica: Base Inicial')
                .setDescription('Qual o valor básico inicial da graduação no Nível 1? (Ex: `+2`, como no D&D)\n\n*Envie apenas o número/valor no chat:*');
            await editarMensagemUnica(interaction, session, embed, null);
            return true;
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_pericia_cat_simnao') {
        const querCat = interaction.values[0] === 'sim';
        session.data.temPericiasCat = querCat;

        if (!querCat) {
            return await xpHandler.iniciarXp(interaction, session);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🏷️ Quais Categorias?')
            .setDescription('Quais categorias quer criar para as perícias? Divida com `,` (Ex: `Fisicas, mentais, sociais`).');

        await editarMensagemUnica(interaction, session, embed, null);
        sessionManager.resetarFlagsTexto(session);
        session.waitingForPericiaCatNomes = true;
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_pericia_cat_escolha') {
        const periciaAtual = session.data.periciasLista[session.periciaCatIndex];
        session.data.periciaCatConfig[periciaAtual] = interaction.values[0];
        session.periciaCatIndex++;

        return await perguntarPericiaCategoria(interaction, session);
    }

    return false;
}

async function processarPericiasTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    // Tratamentos novos para Graduação
    if (session.waitingForGradValorFixo) {
        session.data.graduacaoValorFixo = texto;
        session.waitingForGradValorFixo = false;
        return await iniciarPericiasCategoriaSimNao(message, session);
    }

    if (session.waitingForGradBase) {
        session.data.graduacaoBase = texto;
        session.waitingForGradBase = false;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🛠️ Graduação Dinâmica: Intervalo de Níveis')
            .setDescription('De quantos em quantos níveis a graduação aumenta?\n\n💡 *Exemplo: Digite `3` se a cada 3 níveis a graduação ganha um bônus.* Envie apenas o número no chat:');
        await editarMensagemUnica(message, session, embed, null);
        session.waitingForGradPassoNiveis = true;
        return true;
    }

    if (session.waitingForGradPassoNiveis) {
        session.data.graduacaoPassoNiveis = texto;
        session.waitingForGradPassoNiveis = false;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🛠️ Graduação Dinâmica: Valor do Aumento')
            .setDescription('Sempre que alcançar o marco de níveis necessários, deve-se aumentar a graduação em quanto?\n\n💡 *Exemplo: Se colocar base +2, a cada 3 níveis ganha pontos e colocar incremento `2`, no nível 1 é +2, no nível 4 é +4, no nível 7 é +6.* Envie apenas o número no chat:');
        await editarMensagemUnica(message, session, embed, null);
        session.waitingForGradIncremento = true;
        return true;
    }

    if (session.waitingForGradIncremento) {
        session.data.graduacaoIncremento = texto;
        session.waitingForGradIncremento = false;
        return await iniciarPericiasCategoriaSimNao(message, session);
    }

    if (session.waitingForPericiasNome) {
        session.waitingForPericiasNome = false;
        session.data.nomePericias = texto;
        session.data.periciasLista = texto.split(',').map(s => capitalizar(s.trim())).filter(Boolean);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📈 Representação das Perícias')
            .setDescription('Como os valores das perícias são representados?');

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('rpg_setup_pericias_tipo')
                .setPlaceholder('Escolha o formato...')
                .addOptions([
                    { label: 'Usar o mesmo dos atributos', value: 'mesmo_atributos' },
                    { label: 'Números Diretos (Ex: 15, 10)', value: 'numero' },
                    { label: 'Bolinhas / Níveis de Círculo', value: 'bolinhas' },
                    { label: 'Porcentagem (Ex: 50%, 75%)', value: 'porcentagem' },
                    { label: 'Modificadores (Ex: +2, -1)', value: 'modificador' },
                    { label: 'Escala Pequena Customizada', value: 'escala' }
                ])
        );

        await editarMensagemUnica(message, session, embed, row);
        return true;
    }

    if (session.waitingForPericiasBolinhasMax) {
        session.data.periciasBolinhasMax = texto;
        session.waitingForPericiasBolinhasMax = false;
        return await perguntarCalculoPericias(message, session);
    }

    if (session.waitingForPericiasEscalaMax) {
        session.data.periciasEscalaMax = texto;
        session.waitingForPericiasEscalaMax = false;
        return await perguntarCalculoPericias(message, session);
    }

    return false;
}

module.exports = {
    iniciarPericiasSimNao,
    tratarInteracao,
    processarPericiasTexto,
    receberPericiaCatNomes
};