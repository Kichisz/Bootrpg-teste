const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const sessionManager = require('./sessionManager');
const db = require('../../../database');
const extras = require('./extras');

async function editarMensagemUnicaComExport(channelOrInteraction, session, embed, row = null) {
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
        console.error('Erro ao editar mensagem em recursos.js:', err);
    }
}

async function iniciarRecursos(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('❤️ Sistema de Pontos de Vida (PV)')
        .setDescription('O seu sistema possui pontos de vida, vitalidade ou saúde física?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_tem_pv')
            .setPlaceholder('O sistema possui PV?')
            .addOptions([
                { label: 'Sim, possui PV / Vida', value: 'sim' },
                { label: 'Não utilizamos PV', value: 'nao' }
            ])
    );

    await editarMensagemUnicaComExport(channelOrInteraction, session, embed, row);
    return true;
}

async function iniciarPmSimNao(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('✨ Sistema de Mana / Energia (PM)')
        .setDescription('O seu sistema possui pontos de magia, energia, foco ou estamina?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_tem_pm')
            .setPlaceholder('O sistema possui PM?')
            .addOptions([
                { label: 'Sim, possui PM / Mana', value: 'sim' },
                { label: 'Não utilizamos PM', value: 'nao' }
            ])
    );

    await editarMensagemUnicaComExport(channelOrInteraction, session, embed, row);
    return true;
}

async function iniciarRecursosExtrasSimNao(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🌀 Recursos Adicionais')
        .setDescription('Seu sistema possui outros recursos?\n\n💡 *Exemplo: sanidade, humanidade, sangue, corrupção, energia etc.*');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_tem_recursos_extras')
            .setPlaceholder('O sistema possui outros recursos?')
            .addOptions([
                { label: 'Sim, possui outros recursos', value: 'sim' },
                { label: 'Não possui outros recursos', value: 'nao' }
            ])
    );

    await editarMensagemUnicaComExport(channelOrInteraction, session, embed, row);
    return true;
}

async function perguntarRepresentacaoRecursoExtra(channelOrInteraction, session) {
    if (!session.data.recursosExtrasConfig) {
        session.data.recursosExtrasConfig = [];
    }

    if (session.recursosExtrasIndex >= session.data.recursosExtrasLista.length) {
        return await iniciarCaSimNao(channelOrInteraction, session);
    }

    const nomeRecurso = session.data.recursosExtrasLista[session.recursosExtrasIndex];

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🌀 Representação: ${nomeRecurso}`)
        .setDescription(`Como o valor de **${nomeRecurso}** é representado na ficha?`);

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_recurso_extra_repr')
            .setPlaceholder('Escolha como o valor é representado...')
            .addOptions([
                { label: 'Números Diretos (Ex: 15, 10)', value: 'numeros_diretos' },
                { label: 'Bolinhas / Níveis de Círculo', value: 'bolinhas' },
                { label: 'Porcentagem (Ex: 50%, 75%)', value: 'porcentagem' },
                { label: 'Modificadores (Ex: +2, -1)', value: 'modificadores' },
                { label: 'Escala Pequena Customizada', value: 'escala_pequena' }
            ])
    );

    await editarMensagemUnicaComExport(channelOrInteraction, session, embed, row);
    return true;
}

async function perguntarComportamentoRecursoExtra(channelOrInteraction, session) {
    const nomeRecurso = session.data.recursosExtrasLista[session.recursosExtrasIndex];

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🌀 Comportamento: ${nomeRecurso}`)
        .setDescription(`O recurso **${nomeRecurso}** é um valor que **sobe** (tipo fome de *Vampiro: A Máscara* que sobe a cada uso de magia) ou um valor que **desce** (tipo sangue em alguns tipos de RPG)?`);

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_recurso_extra_comportamento')
            .setPlaceholder('Escolha o comportamento do recurso...')
            .addOptions([
                { label: 'Sobe (Aumenta conforme uso/acúmulo)', value: 'sobe' },
                { label: 'Desce (Diminui conforme uso/gasto)', value: 'desce' }
            ])
    );

    await editarMensagemUnicaComExport(channelOrInteraction, session, embed, row);
    return true;
}

async function iniciarCaSimNao(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Classe de Armadura / Defesa (CA)')
        .setDescription('O sistema possui um atributo ou recurso fixo para defesa passiva contra ataques?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_tem_ca')
            .setPlaceholder('O sistema possui CA?')
            .addOptions([
                { label: 'Sim, possui CA / Defesa', value: 'sim' },
                { label: 'Não utilizamos CA', value: 'nao' }
            ])
    );

    await editarMensagemUnicaComExport(channelOrInteraction, session, embed, row);
    return true;
}

async function iniciarDadosConfig(channelOrInteraction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎲 Configuração de Dados')
        .setDescription('O sistema utiliza o **mesmo dado** tanto para rolagens de combate quanto para rolagens de perícias?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_mesmo_dado')
            .setPlaceholder('Usa o mesmo dado?')
            .addOptions([
                { label: 'Sim, o mesmo dado para tudo', value: 'sim' },
                { label: 'Não, dados diferentes para combate e perícias', value: 'nao' }
            ])
    );

    await editarMensagemUnicaComExport(channelOrInteraction, session, embed, row);
    return true;
}

async function tratarInteracao(interaction) {
    const session = sessionManager.getSession(interaction.user.id);
    if (!session) return false;

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_tem_pv') {
        const tem = interaction.values[0] === 'sim';
        session.data.temPv = tem;

        if (!tem) {
            return await iniciarPmSimNao(interaction, session);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('❤️ Nome do PV')
            .setDescription('Qual é o **nome** dado para a vida/saúde no seu sistema? (Ex: `PV`, `Vida`, `Sanidade`). Envie apenas o nome no chat.');

        await editarMensagemUnicaComExport(interaction, session, embed, null);
        sessionManager.resetarFlagsTexto(session);
        session.waitingForPvNome = true;
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_pv_calc') {
        session.data.pvCalculo = interaction.values[0];
        return await iniciarPmSimNao(interaction, session);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_tem_pm') {
        const tem = interaction.values[0] === 'sim';
        session.data.temPm = tem;

        if (!tem) {
            return await iniciarRecursosExtrasSimNao(interaction, session);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('✨ Nome do PM')
            .setDescription('Qual é o **nome** dado para a mana/energia no seu sistema? (Ex: `PM`, `Mana`, `Foco`). Envie apenas o nome no chat.');

        await editarMensagemUnicaComExport(interaction, session, embed, null);
        sessionManager.resetarFlagsTexto(session);
        session.waitingForPmNome = true;
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_pm_calc') {
        session.data.pmCalculo = interaction.values[0];
        return await iniciarRecursosExtrasSimNao(interaction, session);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_tem_recursos_extras') {
        const tem = interaction.values[0] === 'sim';
        session.data.temRecursosExtras = tem;

        if (!tem) {
            session.data.recursosExtrasLista = [];
            session.data.recursosExtrasConfig = [];
            return await iniciarCaSimNao(interaction, session);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🌀 Nomes dos Recursos')
            .setDescription('Qual o **nome dos recursos** que possui? Envie no chat os nomes separados por `,`.\n\n💡 *Exemplo: `sangue, fome, corrupção, sanidade`*');

        await editarMensagemUnicaComExport(interaction, session, embed, null);
        sessionManager.resetarFlagsTexto(session);
        session.waitingForRecursosExtrasNomes = true;
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_recurso_extra_repr') {
        session.data.recursoAtualRepr = interaction.values[0];
        return await perguntarComportamentoRecursoExtra(interaction, session);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_recurso_extra_comportamento') {
        const comportamento = interaction.values[0];
        const nomeRecurso = session.data.recursosExtrasLista[session.recursosExtrasIndex];

        session.data.recursosExtrasConfig.push({
            nome: nomeRecurso,
            representacao: session.data.recursoAtualRepr,
            fluxo: comportamento
        });

        session.recursosExtrasIndex++;
        return await perguntarRepresentacaoRecursoExtra(interaction, session);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_tem_ca') {
        const tem = interaction.values[0] === 'sim';
        session.data.temCa = tem;

        if (!tem) {
            return await iniciarDadosConfig(interaction, session);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🛡️ Nome da CA')
            .setDescription('Qual é o **nome** da defesa passiva? (Ex: `CA`, `Defesa`, `Esquiva`). Envie apenas o nome no chat.');

        await editarMensagemUnicaComExport(interaction, session, embed, null);
        sessionManager.resetarFlagsTexto(session);
        session.waitingForCaNome = true;
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_setup_mesmo_dado') {
        const mesmo = interaction.values[0] === 'sim';
        session.data.mesmoDado = mesmo;

        sessionManager.resetarFlagsTexto(session);
        if (mesmo) {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎲 Dado Único do Sistema')
                .setDescription('Qual é o **dado** utilizado para todas as rolagens? (Ex: `1d20`, `3d6`). Envie no chat.');
            await editarMensagemUnicaComExport(interaction, session, embed, null);
            session.waitingForDadoUnico = true;
        } else {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎲 Dado de Combate')
                .setDescription('Qual é o dado utilizado para **rolagens de combate**? (Ex: `1d20`). Envie no chat.');
            await editarMensagemUnicaComExport(interaction, session, embed, null);
            session.waitingForDadoCombate = true;
        }
        return true;
    }

    return false;
}

async function processarRecursosTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    if (session.waitingForPvNome) {
        session.waitingForPvNome = false;
        session.data.pvNome = texto;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`❤️ Cálculo de ${session.data.pvNome}`)
            .setDescription(`Como o valor inicial de **${session.data.pvNome}** é calculado?`);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('rpg_setup_pv_calc')
                .setPlaceholder('Escolha a forma de cálculo...')
                .addOptions([
                    { label: 'Base fixa + Atributo (Ex: 10 + Vigor)', value: 'base_mais_atrib' },
                    { label: 'Apenas valor fixo padrão', value: 'fixo' },
                    { label: 'Multiplicador por Nível / Atributo', value: 'multiplicador' },
                    { label: 'Rolagem de dado + Atributo', value: 'dado_mais_atrib' },
                    { label: 'Rolagem de dado', value: 'dado' }
                ])
        );

        await editarMensagemUnicaComExport(message, session, embed, row);
        return true;
    }

    if (session.waitingForPmNome) {
        session.waitingForPmNome = false;
        session.data.pmNome = texto;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`✨ Cálculo de ${session.data.pmNome}`)
            .setDescription(`Como o valor inicial de **${session.data.pmNome}** é calculado?`);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('rpg_setup_pm_calc')
                .setPlaceholder('Escolha a forma de cálculo...')
                .addOptions([
                    { label: 'Base fixa + Atributo (Ex: 5 + Inteligência)', value: 'base_mais_atrib' },
                    { label: 'Apenas valor fixo padrão', value: 'fixo' },
                    { label: 'Multiplicador por Nível / Atributo', value: 'multiplicador' },
                    { label: 'Rolagem de dado + Atributo', value: 'dado_mais_atrib' },
                    { label: 'Rolagem de dado', value: 'dado' }
                ])
        );

        await editarMensagemUnicaComExport(message, session, embed, row);
        return true;
    }

    if (session.waitingForRecursosExtrasNomes) {
        session.waitingForRecursosExtrasNomes = false;
        session.data.recursosExtrasLista = texto.split(',').map(s => {
            const limpo = s.trim();
            return limpo.charAt(0).toUpperCase() + limpo.slice(1);
        }).filter(Boolean);

        session.recursosExtrasIndex = 0;
        session.data.recursosExtrasConfig = [];
        return await perguntarRepresentacaoRecursoExtra(message, session);
    }

    if (session.waitingForCaNome) {
        session.waitingForCaNome = false;
        session.data.caNome = texto;
        return await iniciarDadosConfig(message, session);
    }

    if (session.waitingForDadoUnico) {
        session.waitingForDadoUnico = false;
        session.data.dadoPrincipal = texto;
        session.data.dadoCombate = texto;
        session.data.dadoPericia = texto;
        
        return await extras.perguntarSeGuardaElementos(message, session);
    }

    if (session.waitingForDadoCombate) {
        session.waitingForDadoCombate = false;
        session.data.dadoCombate = texto;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎲 Dado de Perícias')
            .setDescription('Qual é o dado utilizado para **rolagens de perícias / testes gerais**? (Ex: `3d6`, `1d100`). Envie no chat.');

        await editarMensagemUnicaComExport(message, session, embed, null);
        session.waitingForDadoPericia = true;
        return true;
    }

    if (session.waitingForDadoPericia) {
        session.waitingForDadoPericia = false;
        session.data.dadoPericia = texto;

        return await extras.perguntarSeGuardaElementos(message, session);
    }

    return false;
}

module.exports = {
    editarMensagemUnicaComExport,
    iniciarRecursos,
    processarRecursosTexto,
    tratarInteracao
};