const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

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
    session.etapaAtual = 'arma_simnao';
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚔️ Passo 11/12 — Arma Inicial')
        .setDescription('O seu personagem começará o RPG equipado com alguma arma de combate?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ficha_setup_arma_simnao')
            .setPlaceholder('Selecione uma opção...')
            .addOptions([
                { label: 'Sim, iniciar com arma', value: 'sim' },
                { label: 'Não iniciar com arma', value: 'nao' }
            ])
    );

    const payload = { embeds: [embed], components: [row] };
    return await enviarOuEditar(channelOrMessage, payload, session);
}

async function tratarSimNao(interaction, session) {
    if (interaction.customId !== 'ficha_setup_arma_simnao') return false;

    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (e) {}

    const querArma = interaction.values[0] === 'sim';
    session.data.temArma = querArma;

    if (!querArma) {
        session.etapaAtual = 'armadura_simnao';
        const fichaArmadura = require('./fichaArmadura');
        if (typeof fichaArmadura.iniciarSimNao === 'function') {
            return fichaArmadura.iniciarSimNao(interaction, session);
        } else if (typeof fichaArmadura.iniciarSimNaoNoChat === 'function') {
            return fichaArmadura.iniciarSimNaoNoChat(interaction.message || interaction, session);
        }
        return;
    }

    session.etapaAtual = 'arma_nome';
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚔️ Nome da Arma Principal')
        .setDescription('Qual é o **nome da sua arma** principal?\n\n*Exemplo: Espada Flamejante de Ortis*');

    const payload = { embeds: [embed], components: [] };
    return await enviarOuEditar(interaction, payload, session);
}

async function processarNome(message, session) {
    try { await message.delete(); } catch (e) {}
    session.data.armaNome = message.content.trim();
    return perguntarDadoSimNao(message, session);
}

async function perguntarDadoSimNao(target, session) {
    session.etapaAtual = 'arma_dado_simnao';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚔️ Rolagem de Dano da Arma')
        .setDescription(
            `A sua arma (**${session.data.armaNome}**) possui uma **rolagem de dados própria para dano**? ` +
            `(Como em sistemas onde uma adaga rola 1d6 e um espadão rola 1d10, por exemplo).`
        );

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('arma_dado_simnao_menu')
            .setPlaceholder('Selecione uma opção...')
            .addOptions([
                { label: 'Sim, possui dado próprio de dano', value: 'sim' },
                { label: 'Não possui dado próprio', value: 'nao' }
            ])
    );

    const payload = { embeds: [embed], components: [row] };
    const msg = await enviarOuEditar(target, payload, session);
    if (msg) session.botMessage = msg;

    const filter = i => i.user.id === (target.author?.id || target.user?.id);
    const collector = session.botMessage.createMessageComponentCollector({ filter, time: 300000, max: 1 });

    collector.on('collect', async interaction => {
        try { await interaction.deferUpdate(); } catch (e) {}

        const temDado = interaction.values[0] === 'sim';
        session.data.armaTemDado = temDado;

        if (!temDado) {
            session.data.armaDado = null;
            await perguntarBonusSimNao(interaction, session);
        } else {
            session.etapaAtual = 'arma_dado_valor';
            const embedValor = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('⚔️ Qual o Dado de Dano?')
                .setDescription('Qual é a **rolagem de dado de dano** da sua arma?\n\n*Exemplo: 1d8, 1d10, 2d6, etc.*');
            const payloadValor = { embeds: [embedValor], components: [] };
            await enviarOuEditar(interaction, payloadValor, session);
        }
    });
}

async function processarDadoValor(message, session) {
    try { await message.delete(); } catch (e) {}
    session.data.armaDado = message.content.trim();
    return perguntarBonusSimNao(message, session);
}

async function perguntarBonusSimNao(target, session) {
    session.etapaAtual = 'arma_bonus_simnao';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚔️ Bônus de Ataque ou Dano')
        .setDescription('A sua arma concede **algum bônus fixo** em rolagens de dano ou ataque?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('arma_bonus_simnao_menu')
            .setPlaceholder('Selecione uma opção...')
            .addOptions([
                { label: 'Sim, possui bônus', value: 'sim' },
                { label: 'Não possui bônus', value: 'nao' }
            ])
    );

    const payload = { embeds: [embed], components: [row] };
    const msg = await enviarOuEditar(target, payload, session);
    if (msg) session.botMessage = msg;

    const filter = i => i.user.id === (target.author?.id || target.user?.id);
    const collector = session.botMessage.createMessageComponentCollector({ filter, time: 300000, max: 1 });

    collector.on('collect', async interaction => {
        try { await interaction.deferUpdate(); } catch (e) {}

        const temBonus = interaction.values[0] === 'sim';
        session.data.armaTemBonus = temBonus;

        if (!temBonus) {
            session.data.armaBonus = null;
            session.etapaAtual = 'arma_desc';
            const embedDesc = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('⚔️ Descrição Detalhada da Arma')
                .setDescription('Faça uma **descrição detalhada** de como a sua arma é fisicamente e como é o seu funcionamento:\n\n*Quanto mais detalhada, melhor!*');
            const payloadDesc = { embeds: [embedDesc], components: [] };
            await enviarOuEditar(interaction, payloadDesc, session);
        } else {
            session.etapaAtual = 'arma_bonus_valor';
            const embedBonus = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('⚔️ Qual o Valor do Bônus?')
                .setDescription(
                    'Qual é o valor do bônus?\n\n' +
                    '💡 *Dica: Digite apenas o número inteiro sem o "+". Exemplo: digite **5** para "+5". Se for negativo, digite com o sinal, como **-2**.*'
                );
            const payloadBonus = { embeds: [embedBonus], components: [] };
            await enviarOuEditar(interaction, payloadBonus, session);
        }
    });
}

async function processarBonusValor(message, session) {
    try { await message.delete(); } catch (e) {}
    const inputTexto = message.content.trim();
    const numero = parseInt(inputTexto, 10);

    if (!isNaN(numero)) {
        session.data.armaBonus = numero >= 0 ? `+${numero}` : `${numero}`;
    } else {
        session.data.armaBonus = inputTexto;
    }

    session.etapaAtual = 'arma_desc';
    const embedDesc = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚔️ Descrição Detalhada da Arma')
        .setDescription('Faça uma **descrição detalhada** de como a sua arma é fisicamente e como é o seu funcionamento:\n\n*Quanto mais detalhada, melhor!*');
    const payloadDesc = { embeds: [embedDesc], components: [] };
    return await enviarOuEditar(message, payloadDesc, session);
}

async function processarDesc(message, session) {
    try { await message.delete(); } catch (e) {}
    session.data.armaDesc = message.content.trim();

    session.etapaAtual = 'arma_tipo_escolha';
    const embedTipo = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚔️ Tipo de Arma')
        .setDescription('Essa arma é considerada o quê?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('arma_tipo_menu')
            .setPlaceholder('Selecione o tipo da arma...')
            .addOptions([
                { label: 'Melee', description: 'soqueiras, soco ingles etc', value: 'Melee' },
                { label: 'Arma branca', description: 'espadas, adagas, bastão de baiseball etc', value: 'Arma branca' },
                { label: 'Ranged', description: 'Arco, pistolas, metralhadoras etc', value: 'Ranged' }
            ])
    );

    const payload = { embeds: [embedTipo], components: [row] };
    const msg = await enviarOuEditar(message, payload, session);
    if (msg) session.botMessage = msg;

    const filter = i => i.user.id === message.author.id;
    const collector = session.botMessage.createMessageComponentCollector({ filter, time: 300000, max: 1 });

    collector.on('collect', async interaction => {
        try { await interaction.deferUpdate(); } catch (e) {}

        session.data.armaTipo = interaction.values[0];

        session.etapaAtual = 'armadura_simnao';
        const fichaArmadura = require('./fichaArmadura');
        if (typeof fichaArmadura.iniciarSimNaoNoChat === 'function') {
            return fichaArmadura.iniciarSimNaoNoChat(interaction, session);
        } else if (typeof fichaArmadura.iniciarSimNao === 'function') {
            return fichaArmadura.iniciarSimNao(interaction, session);
        }
    });
}

async function processar(message, session) {
    const etapa = session.etapaAtual;
    if (etapa === 'arma_nome') {
        return processarNome(message, session);
    } else if (etapa === 'arma_dado_valor') {
        return processarDadoValor(message, session);
    } else if (etapa === 'arma_bonus_valor') {
        return processarBonusValor(message, session);
    } else if (etapa === 'arma_desc') {
        return processarDesc(message, session);
    }
}

module.exports = { 
    iniciarSimNao, 
    tratarSimNao, 
    processar,
    processarNome,
    processarDadoValor,
    processarBonusValor,
    processarDesc
};