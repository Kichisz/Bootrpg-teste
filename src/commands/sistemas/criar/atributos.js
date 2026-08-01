const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const sessionManager = require('./sessionManager');

function capitalizar(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function resetarFlagsTextoSeguro(session) {
    if (typeof sessionManager.resetarFlagsTexto === 'function') {
        sessionManager.resetarFlagsTexto(session);
    } else {
        session.waitingForAtribNomes = false;
        session.waitingForAtribBase = false;
        session.waitingForAtribPasso = false;
        session.waitingForBolinhasMax = false;
        session.waitingForEscalaMax = false;
        session.waitingForAtribCatNomes = false;
    }
}

async function editarMensagemUnica(channelOrInteraction, session, embed, row = null) {
    let msg = null;
    const payload = { embeds: [embed], components: row ? [row] : [] };

    try {
        if (channelOrInteraction && typeof channelOrInteraction.update === 'function') {
            if (!channelOrInteraction.deferred && !channelOrInteraction.replied) {
                msg = await channelOrInteraction.update(payload).catch(() => null);
            } else {
                msg = await channelOrInteraction.editReply(payload).catch(() => null);
            }
        }

        if (!msg && channelOrInteraction && typeof channelOrInteraction.editReply === 'function') {
            msg = await channelOrInteraction.editReply(payload).catch(() => null);
        }

        if (!msg && channelOrInteraction && typeof channelOrInteraction.edit === 'function') {
            msg = await channelOrInteraction.edit(payload).catch(() => null);
        }

        if (!msg && session.lastInteraction && typeof session.lastInteraction.editReply === 'function') {
            msg = await session.lastInteraction.editReply(payload).catch(() => null);
        }

        if (!msg && session.lastInteraction && typeof session.lastInteraction.followUp === 'function') {
            msg = await session.lastInteraction.followUp({ ...payload, ephemeral: true }).catch(() => null);
        }

        // Fallback robusto caso receba um canal de texto diretamente (ex: após inputs de texto)
        if (!msg) {
            const targetChannel = (channelOrInteraction && typeof channelOrInteraction.send === 'function' ? channelOrInteraction : null) ||
                                    (channelOrInteraction && channelOrInteraction.channel) || 
                                    (session.lastInteraction && session.lastInteraction.channel);
            if (targetChannel && typeof targetChannel.send === 'function') {
                msg = await targetChannel.send(payload).catch(() => null);
            }
        }
    } catch (err) {
        console.error('Erro em editarMensagemUnica:', err);
    }

    if (msg) {
        sessionManager.salvarMensagemAtual(session, msg);
    }
    return msg;
}

async function receberNomeSistema(message, session) {
    const dinheiroHandler = require('./dinheiro');
    session.data.nomeSistema = capitalizar(message.content.trim());
    session.waitingForName = false;

    try { await message.delete(); } catch (e) {}

    return await dinheiroHandler.iniciarDinheiro(message, session);
}

async function iniciarAtributosSimNao(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🛠️ Sistema: ${session.data.nomeSistema || 'RPG'}`)
        .setDescription(
            'O núcleo do seu personagem é definido pelos atributos físicos e mentais?\n\n' +
            '💡 *Exemplo: Força, Destreza, Constituição, Inteligência, Sabedoria e Carisma.* Se o seu RPG usa estatísticas similares, selecione **Sim**.'
        );

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_atrib_simnao')
            .setPlaceholder('O sistema possui atributos?')
            .addOptions([
                { label: 'Sim, possui atributos principais', value: 'sim' },
                { label: 'Não, o sistema é focado em outras mecânicas', value: 'nao' }
            ])
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

async function iniciarAtributosCategoriaSimNao(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🏷️ Categorias de Atributos')
        .setDescription('Deseja agrupar os atributos por categoria nas fichas?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_atrib_cat_simnao')
            .setPlaceholder('Agrupar atributos por categoria?')
            .addOptions([
                { label: 'Sim', value: 'sim' },
                { label: 'Não', value: 'nao' }
            ])
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

async function perguntarAtributoCategoria(channelOrInteraction, session) {
    const periciasHandler = require('./pericias');
    if (!session.data.atribCatConfig) {
        session.data.atribCatConfig = {};
    }

    if (session.atribCatIndex >= session.data.atributosLista.length) {
        return await periciasHandler.iniciarPericiasSimNao(channelOrInteraction, session);
    }

    const atributoAtual = session.data.atributosLista[session.atribCatIndex];

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🏷️ Categoria do Atributo')
        .setDescription(`Qual categoria devemos colocar o atributo **${atributoAtual}**?`);

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_atrib_cat_escolha')
            .setPlaceholder('Selecione a categoria...')
            .addOptions(
                session.data.atribCatLista.map(cat => ({
                    label: cat.substring(0, 100),
                    value: cat
                }))
            )
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

async function receberAtribCatNomes(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    session.data.atribCatLista = texto.split(',').map(s => capitalizar(s.trim())).filter(Boolean);
    session.waitingForAtribCatNomes = false;
    session.atribCatIndex = 0;
    session.data.atribCatConfig = {};

    return await perguntarAtributoCategoria(message, session);
}

async function tratarInteracaoSelects(interaction) {
    const session = sessionManager.getSession(interaction.user.id);
    if (!session) return false;

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_atrib_simnao') {
        session.data.temAtributos = interaction.values[0] === 'sim';

        if (!session.data.temAtributos) {
            const periciasHandler = require('./pericias');
            return await periciasHandler.iniciarPericiasSimNao(interaction, session);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('💪 Configuração de Atributos')
            .setDescription(
                'Quais serão os **nomes dos atributos** principais do seu sistema?\n\n' +
                'Envie no chat a lista com os nomes separados por vírgula.\n\n' +
                '💡 *Exemplo: `Força, Destreza, Vigor, Inteligência, Presença`*'
            );

        await editarMensagemUnica(interaction, session, embed, null);
        resetarFlagsTextoSeguro(session);
        session.waitingForAtribNomes = true;
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_atrib_tipo') {
        const tipo = interaction.values[0];
        session.data.tipoAtributos = tipo;

        if (tipo === 'numero') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🔢 Base dos Modificadores')
                .setDescription('qual a base desses números? exemplo, D&D é a cada 2 acima ou abaixo do numero base 10, se você escolher 4 seria "2 a cada numero acima ou abaixo de 4", lembrando que após isso vamos perguntar quantos acima desse numero equivale a +1');
            
            await editarMensagemUnica(interaction, session, embed, null);
            resetarFlagsTextoSeguro(session);
            session.waitingForAtribBase = true;
            return true;
        }

        if (tipo === 'bolinhas') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🔵 Máximo de Bolinhas')
                .setDescription('Qual é o **máximo que um jogador pode ter** nos atributos em formato de bolinhas? (Ex: `6`).');
            
            await editarMensagemUnica(interaction, session, embed, null);
            resetarFlagsTextoSeguro(session);
            session.waitingForBolinhasMax = true;
            return true;
        }

        if (tipo === 'escala') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 Escala Numérica de Atributos')
                .setDescription('Qual é o **valor máximo** que um atributo pode atingir? Envie apenas o número no chat (Ex: `5`).');
            
            await editarMensagemUnica(interaction, session, embed, null);
            resetarFlagsTextoSeguro(session);
            session.waitingForEscalaMax = true;
            return true;
        }

        if (tipo === 'porcentagem') {
            session.data.tipoAtributos = '%';
            session.data.tipoCalculoAtributo = 'porcentagem';
            return await perguntarDestrezaArmadura(interaction, session);
        }

        session.data.tipoCalculoAtributo = 'simples';
        return await perguntarDestrezaArmadura(interaction, session);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_atrib_destreza_simnao') {
        session.data.temDestrezaArmadura = interaction.values[0] === 'sim';

        if (!session.data.temDestrezaArmadura) {
            return await iniciarAtributosCategoriaSimNao(interaction, session);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🛡️ Vínculo de Armadura Pesada')
            .setDescription('Qual dos atributos listados abaixo funciona como a **Destreza / Agilidade**?');

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('rpg_setup_qual_destreza')
                .setPlaceholder('Selecione o atributo...')
                .addOptions((session.data.atributosLista || ['Força', 'Destreza']).map(a => ({ label: a, value: a })))
        );

        await editarMensagemUnica(interaction, session, embed, row);
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_qual_destreza') {
        session.data.atributoDestreza = interaction.values[0];
        return await iniciarAtributosCategoriaSimNao(interaction, session);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_atrib_cat_simnao') {
        const querCat = interaction.values[0] === 'sim';
        session.data.temAtributosCat = querCat;

        if (!querCat) {
            const periciasHandler = require('./pericias');
            return await periciasHandler.iniciarPericiasSimNao(interaction, session);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🏷️ Quais Categorias?')
            .setDescription('Quais categorias quer criar para os atributos? Divida com `,` (Ex: `Fisicos, sociais, mentais`).');

        await editarMensagemUnica(interaction, session, embed, null);
        resetarFlagsTextoSeguro(session);
        session.waitingForAtribCatNomes = true;
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_atrib_cat_escolha') {
        const atributoAtual = session.data.atributosLista[session.atribCatIndex];
        session.data.atribCatConfig[atributoAtual] = interaction.values[0];
        session.atribCatIndex++;

        return await perguntarAtributoCategoria(interaction, session);
    }

    return false;
}

async function receberAtributosNomes(message, session) {
    session.data.atributosLista = message.content.split(',').map(s => capitalizar(s.trim())).filter(Boolean);
    session.waitingForAtribNomes = false;
    try { await message.delete(); } catch (e) {}

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📈 Representação dos Atributos')
        .setDescription('Como os valores dos atributos são retratados na ficha?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_atrib_tipo')
            .setPlaceholder('Escolha o formato...')
            .addOptions([
                { 
                    label: 'Modificadores', 
                    description: 'Ex: 12 = +1 (a cada 2 acima de 10 = +1, abaixo = -1)', 
                    value: 'numero' 
                },
                { label: 'Bolinhas / Níveis de Círculo', value: 'bolinhas' },
                { label: 'Porcentagem (Ex: 50%, 75%)', value: 'porcentagem' },
                { label: 'Modificadores Simples (Ex: +2, -1)', value: 'modificador' },
                { label: 'Escala Pequena Customizada', value: 'escala' }
            ])
    );

    await editarMensagemUnica(message, session, embed, row);
}

async function receberAtribBase(message, session) {
    session.data.atribBase = message.content.trim();
    session.waitingForAtribBase = false;
    try { await message.delete(); } catch (e) {}

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('➕ Equivalência para +1')
        .setDescription(`quantos acima de ${session.data.atribBase} equivale a +1 no seu sistema?`);

    await editarMensagemUnica(message, session, embed, null);
    session.waitingForAtribPasso = true;
}

async function receberAtribPasso(message, session) {
    session.data.atribPasso = message.content.trim();
    session.waitingForAtribPasso = false;
    try { await message.delete(); } catch (e) {}

    session.data.tipoCalculoAtributo = 'modificadores';
    return await perguntarDestrezaArmadura(message, session);
}

async function receberBolinhasMax(message, session) {
    session.data.bolinhasMax = message.content.trim();
    session.waitingForBolinhasMax = false;
    try { await message.delete(); } catch (e) {}

    session.data.tipoCalculoAtributo = 'simples';
    return await perguntarDestrezaArmadura(message, session);
}

async function receberEscalaMax(message, session) {
    session.data.escalaMax = message.content.trim();
    session.waitingForEscalaMax = false;
    try { await message.delete(); } catch (e) {}

    session.data.tipoCalculoAtributo = 'simples';
    return await perguntarDestrezaArmadura(message, session);
}

async function perguntarDestrezaArmadura(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Penalidade de Armadura')
        .setDescription('Existe algum atributo que dita a agilidade e aplica penalidades de armadura pesada?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_atrib_destreza_simnao')
            .setPlaceholder('Possui atributo de Destreza?')
            .addOptions([
                { label: 'Sim, existe', value: 'sim' },
                { label: 'Não aplicamos isso', value: 'nao' }
            ])
    );

    await editarMensagemUnica(channelOrInteraction, session, embed, row);
    return true;
}

module.exports = {
    tratarInteracaoSelects,
    receberNomeSistema,
    iniciarAtributosSimNao,
    receberAtributosNomes,
    receberAtribBase,
    receberAtribPasso,
    receberBolinhasMax,
    receberEscalaMax,
    receberAtribCatNomes
};