const { EmbedBuilder, MessageFlags } = require('discord.js');
const { getDb } = require('../database/dbConnection');
const { enviarMenuPrincipal } = require('../menu/sendMainMenu');

async function executarFluxoChatSubtipos(interaction, sistema, nomeListaFixa = null) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
    }

    const filter = m => m.author.id === interaction.user.id;
    const channel = interaction.channel;

    async function pedirInput(embed) {
        await interaction.editReply({ embeds: [embed], components: [] }).catch(async () => {
            await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});
        });

        try {
            const collected = await channel.awaitMessages({ filter, max: 1, time: 120_000, errors: ['time'] });
            const msg = collected.first();
            await msg.delete().catch(() => {}); // Remove a mensagem digitada pelo usuário no chat para manter limpo
            return msg.content.trim();
        } catch {
            return null;
        }
    }

    let nomeLista = nomeListaFixa;

    // Passo 1: Nome da Lista (caso não tenha vindo pronto)
    if (!nomeLista) {
        const embedPasso1 = new EmbedBuilder()
            .setTitle('🛡️ Salvaguarda - Criar Nova Lista')
            .setDescription(
                '**[Passo 1/3]**\n\n' +
                'Digite no chat o **nome que deseja dar para esta nova lista** de subtipos:\n\n' +
                '💡 *Exemplo:* `Lista subtipos <nome do sistema>`'
            )
            .setColor(0x5865F2);

        nomeLista = await pedirInput(embedPasso1);
        if (!nomeLista) {
            const embedErro = new EmbedBuilder().setTitle('⏳ Tempo Esgotado').setDescription('Operação cancelada por inatividade.').setColor(0xED4245);
            await interaction.editReply({ embeds: [embedErro] }).catch(() => {});
            return;
        }
    }

    // Passo 2: Subtipos
    const embedPasso2 = new EmbedBuilder()
        .setTitle(`🛡️ Criando Lista: ${nomeLista}`)
        .setDescription(
            '**[Passo 2/3]**\n\n' +
            'Digite os **subtipos** no chat usando o formato `Tipo:Subtipo` (separados por vírgula):\n\n' +
            '💡 **Exemplo prático:**\n' +
            '`Físico: Cinético / Balístico, Mental: Cognitivo / Ilusão`'
        )
        .setColor(0x5865F2);

    const textoSubtipos = await pedirInput(embedPasso2);
    if (!textoSubtipos) {
        const embedErro = new EmbedBuilder().setTitle('⏳ Tempo Esgotado').setDescription('Operação cancelada por inatividade.').setColor(0xED4245);
        await interaction.editReply({ embeds: [embedErro] }).catch(() => {});
        return;
    }

    const linhas = textoSubtipos.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
    const itens = [];
    for (const linha of linhas) {
        const partes = linha.split(':').map(p => p.trim());
        if (partes.length >= 2) {
            const tipo = partes[0];
            const subtipo = partes.slice(1).join(':');
            itens.push({ tipo, subtipo });
        }
    }

    if (itens.length === 0) {
        const embedErro = new EmbedBuilder()
            .setTitle('❌ Formato Inválido')
            .setDescription('Nenhum subtipo válido encontrado no formato `Tipo:Subtipo`. Tente novamente acionando o menu.')
            .setColor(0xED4245);
        await interaction.editReply({ embeds: [embedErro] }).catch(() => {});
        return;
    }

    // Passo 3: Loop de descrições no chat
    const acumulados = [];
    for (let i = 0; i < itens.length; i++) {
        const atual = itens[i];
        const embedPasso3 = new EmbedBuilder()
            .setTitle(`🛡️ Descrição do Subtipo (${i + 1}/${itens.length})`)
            .setDescription(
                `**Tipo:** ${atual.tipo}\n` +
                `**Subtipo:** ${atual.subtipo}\n\n` +
                'Digite no chat a **descrição** deste subtipo:\n\n' +
                '💡 **Exemplo de como preencher:**\n' +
                '> **Descrição:** O que engloba:Golpes físicos diretos, projéteis, disparos, lâminas, pancadas e telecinese focada em impacto físico.\n' +
                '> Defesa padrão comum: Esquiva, Destreza, Reflexos ou CA.'
            )
            .setColor(0x5865F2);

        const desc = await pedirInput(embedPasso3);

        if (!desc) {
            const embedErro = new EmbedBuilder().setTitle('⏳ Tempo Esgotado').setDescription('Operação cancelada durante as descrições.').setColor(0xED4245);
            await interaction.editReply({ embeds: [embedErro] }).catch(() => {});
            return;
        }

        acumulados.push({ tipo: atual.tipo, subtipo: atual.subtipo, descricao: desc });
    }

    // Salvar no Banco de Dados
    const db = getDb();
    const stmt = db.prepare('INSERT INTO subtipos_salvaguarda (userId, sistema, nomeLista, tipo, subtipo, descricao) VALUES (?, ?, ?, ?, ?, ?)');
    const insertMany = db.transaction((arr) => {
        for (const item of arr) {
            stmt.run(interaction.user.id, sistema, nomeLista, item.tipo, item.subtipo, item.descricao);
        }
    });
    insertMany(acumulados);
    db.close();

    const embedSucesso = new EmbedBuilder()
        .setTitle('✅ Lista Criada com Sucesso!')
        .setDescription(`A lista **"${nomeLista}"** foi salva com **${acumulados.length}** subtipos estruturados!`)
        .setColor(0x57F287);

    await interaction.editReply({ embeds: [embedSucesso], components: [] }).catch(() => {});
    return enviarMenuPrincipal(interaction, nomeLista, sistema);
}

module.exports = { executarFluxoChatSubtipos };