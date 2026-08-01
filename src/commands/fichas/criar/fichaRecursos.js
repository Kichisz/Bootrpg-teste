const { EmbedBuilder } = require('discord.js');
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
        console.error('Erro ao carregar sistema ativo para recursos extras:', err);
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
    const channel = target.channel || target;
    if (channel && typeof channel.send === 'function') {
        session.botMessage = await channel.send(payload).catch(() => {});
        return session.botMessage;
    }
}

async function iniciar(message, session) {
    const config = carregarSistemaConfig(session);
    
    if (!config.temRecursosExtras || !config.recursosExtrasConfig || config.recursosExtrasConfig.length === 0) {
        session.etapaAtual = 'ca';
        const fichaCa = require('./fichaCa');
        return fichaCa.iniciar(message, session);
    }

    session.recursosExtrasLista = config.recursosExtrasConfig;
    session.recursoIndiceAtual = 0;
    session.data.recursosExtrasValores = {};

    return perguntarRecurso(message, session);
}

async function perguntarRecurso(message, session) {
    if (session.recursoIndiceAtual >= session.recursosExtrasLista.length) {
        session.etapaAtual = 'ca';
        const fichaCa = require('./fichaCa');
        return fichaCa.iniciar(message, session);
    }

    const rec = session.recursosExtrasLista[session.recursoIndiceAtual];
    session.recursoAtualNome = rec.nome;

    const fluxoTexto = rec.fluxo === 'sobe' 
        ? 'acumulativo (um valor que se eleva conforme o uso ou desgaste)' 
        : 'decrescente (um valor máximo que decai à medida que é consumido)';

    let detalhesRepresentacao = '';
    let exemploPratico = '';

    switch (rec.representacao) {
        case 'porcentagem':
            detalhesRepresentacao = 'Este recurso é medido em **escala percentual (%)**, refletindo a proporção atual em relação ao seu ápice.';
            exemploPratico = `💡 *Exemplo:* Se você definir **100**, o valor inicial será registrado como **100%**, operando dentro dessa margem proporcional.`;
            break;
        case 'bolinhas':
            detalhesRepresentacao = 'Este recurso é representado visualmente por **círculos ou níveis de progression (bolinhas)**.';
            exemploPratico = `💡 *Exemplo:* Se você definir **5**, o personagem disporá de **5 bolinhas** máximas para este recurso na ficha.`;
            break;
        case 'numeros_diretos':
            detalhesRepresentacao = 'Este recurso utiliza **números absolutos e diretos** para o seu controle.';
            exemploPratico = `💡 *Exemplo:* Se você definir **10**, o personagem iniciará com exatamente **10 pontos** inteiros deste recurso.`;
            break;
        case 'modificadores':
            detalhesRepresentacao = 'Este recurso atua sob a forma de **modificadores com polaridade** (bônus ou penalidades).';
            exemploPratico = `💡 *Exemplo:* Se você definir **2**, o valor inicial será configurado como **+2**.`;
            break;
        case 'escala_pequena':
            detalhesRepresentacao = 'Este recurso segue uma **escala compacta customizada** de níveis.';
            exemploPratico = `💡 *Exemplo:* Se você definir **3**, o patamar inicial será fixado no **nível 3** dessa escala.`;
            break;
        default:
            detalhesRepresentacao = 'Este recurso possui um formato numérico personalizado.';
            exemploPratico = `💡 *Exemplo:* Insira o valor numérico inicial desejado.`;
            break;
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🌀 Passo 9/12 — Recurso Extra: ${rec.nome}`)
        .setDescription(
            `O sistema ativo estruturou este elemento como um recurso do tipo **${rec.nome}**.\n\n` +
            `📜 **Dinâmica da Mecânica:** O fluxo deste elemento é **${fluxoTexto}**.\n` +
            `${detalhesRepresentacao}\n\n` +
            `${exemploPratico}\n\n` +
            `✨ Por favor, informe abaixo o **valor numérico inicial** para **${rec.nome}**:`
        );

    const payload = { embeds: [embed] };
    return await enviarOuEditar(message, payload, session);
}

async function processar(message, session) {
    try { await message.delete(); } catch (e) {}
    session.data.recursosExtrasValores[session.recursoAtualNome] = message.content.trim();
    session.recursoIndiceAtual++;

    return perguntarRecurso(message, session);
}

module.exports = { iniciar, processar };