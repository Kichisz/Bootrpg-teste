const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const fichaFinalizar = require('./fichaFinalizar');

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

async function iniciarSimNao(channelOrMessage, session) {
    session.etapaAtual = 'armadura_simnao';
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Passo 12/12 — Armadura Inicial')
        .setDescription('O seu personagem começará equipado com alguma proteção corporal ou armadura?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ficha_setup_armadura_simnao')
            .setPlaceholder('Selecione uma opção...')
            .addOptions([
                { label: 'Sim, iniciar com armadura', value: 'sim' },
                { label: 'Não iniciar com armadura', value: 'nao' }
            ])
    );

    const payload = { embeds: [embed], components: [row] };
    return await enviarOuEditar(channelOrMessage, payload, session);
}

async function iniciarSimNaoNoChat(message, session) {
    return iniciarSimNao(message, session);
}

async function tratarSimNao(interaction, session) {
    if (interaction.customId !== 'ficha_setup_armadura_simnao') return false;

    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (e) {}

    const querArmadura = interaction.values[0] === 'sim';
    session.data.temArmadura = querArmadura;

    if (!querArmadura) {
        return fichaFinalizar.concluir(interaction, session);
    }

    session.etapaAtual = 'armadura_nome';
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Nome da Armadura')
        .setDescription('Qual é o **nome da sua armadura** ou proteção?\n\n*Exemplo: Armadura de Couro, Cota de Malhas, etc.*');

    const payload = { embeds: [embed], components: [] };
    return await enviarOuEditar(interaction, payload, session);
}

async function processarNome(message, session) {
    try { await message.delete(); } catch (e) {}
    session.data.armaduraNome = message.content.trim();
    session.etapaAtual = 'armadura_bonus_ca';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Bônus de CA da Armadura')
        .setDescription(
            `Qual é o **bônus que a armadura (${session.data.armaduraNome}) dará na sua CA**?\n\n` +
            `💡 *Dica: Digite apenas o número inteiro (exemplo: digite **5** para "+5").*`
        );

    const payload = { embeds: [embed], components: [] };
    return await enviarOuEditar(message, payload, session);
}

async function processarBonusCa(message, session) {
    try { await message.delete(); } catch (e) {}
    const inputTexto = message.content.trim();
    const numero = parseInt(inputTexto, 10);

    if (!isNaN(numero)) {
        session.data.armaduraBonusCa = numero >= 0 ? `+${numero}` : `${numero}`;
    } else {
        session.data.armaduraBonusCa = inputTexto;
    }

    const config = session.sistemaConfig || {};
    const penalidadeAtiva = config.armaduraPesadaNegativa || config.penalidadeArmaduraPesada || false;
    const nomeStatusDestreza = config.statusDestrezaNome || config.nomeStatusDestreza || 'Destreza';

    if (penalidadeAtiva) {
        session.etapaAtual = 'armadura_pesada_simnao';
        session.data.nomeStatusDestreza = nomeStatusDestreza;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🛡️ Impacto de Armadura Pesada')
            .setDescription(`Sua armadura é considerada uma **armadura pesada** que impacta no status **${nomeStatusDestreza}**?`);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ficha_setup_armadura_pesada_menu')
                .setPlaceholder('Selecione uma opção...')
                .addOptions([
                    { label: 'Sim, é armadura pesada com impacto', value: 'sim' },
                    { label: 'Não, não afeta o status', value: 'nao' }
                ])
        );

        const payload = { embeds: [embed], components: [row] };
        return await enviarOuEditar(message, payload, session);
    } else {
        session.data.armaduraPenalidadeDestreza = 0;
        session.etapaAtual = 'armadura_desc';

        const embedDesc = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🛡️ Descrição Detalhada da Armadura')
            .setDescription('Faça uma **descrição detalhada** de como a sua armadura é fisicamente (isso será usado no futuro):');

        const payload = { embeds: [embedDesc], components: [] };
        return await enviarOuEditar(message, payload, session);
    }
}

async function tratarPesadaSimNao(interaction, session) {
    if (interaction.customId !== 'ficha_setup_armadura_pesada_menu') return false;

    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (e) {}

    const ehPesada = interaction.values[0] === 'sim';
    session.data.ehArmaduraPesada = ehPesada;

    if (!ehPesada) {
        session.data.armaduraPenalidadeDestreza = 0;
        session.etapaAtual = 'armadura_desc';

        const embedDesc = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🛡️ Descrição Detalhada da Armadura')
            .setDescription('Faça uma **descrição detalhada** de como a sua armadura é fisicamente (isso será usado no futuro):');

        const payload = { embeds: [embedDesc], components: [] };
        return await enviarOuEditar(interaction, payload, session);
    } else {
        session.etapaAtual = 'armadura_pesada_valor';
        const nomeStatus = session.data.nomeStatusDestreza || 'Destreza';

        const embedValor = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🛡️ Valor de Impacto no Status')
            .setDescription(
                `Coloque o **valor negativo** que ela irá impactar no status **${nomeStatus}**.\n` +
                `*(Exemplo: se o impacto for 5, digite **5** e o bot converterá para **-5**. Se não houver impacto ou quiser zerar, digite **0**).*`
            );

        const payload = { embeds: [embedValor], components: [] };
        return await enviarOuEditar(interaction, payload, session);
    }
}

async function processarPesadaValor(message, session) {
    try { await message.delete(); } catch (e) {}
    const inputTexto = message.content.trim();
    const numero = parseInt(inputTexto, 10);

    if (!isNaN(numero)) {
        session.data.armaduraPenalidadeDestreza = numero > 0 ? -numero : numero;
    } else {
        session.data.armaduraPenalidadeDestreza = 0;
    }

    session.etapaAtual = 'armadura_desc';
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Descrição Detalhada da Armadura')
        .setDescription('Faça uma **descrição detalhada** de como a sua armadura é fisicamente (isso será usado no futuro):');

    const payload = { embeds: [embed], components: [] };
    return await enviarOuEditar(message, payload, session);
}

async function processarDesc(message, session) {
    try { await message.delete(); } catch (e) {}
    session.data.armaduraDesc = message.content.trim();
    return fichaFinalizar.concluirNoChat(message, session);
}

module.exports = { 
    iniciarSimNao, 
    iniciarSimNaoNoChat, 
    tratarSimNao, 
    tratarPesadaSimNao,
    processarNome, 
    processarBonusCa,
    processarPesadaValor,
    processarDesc 
};