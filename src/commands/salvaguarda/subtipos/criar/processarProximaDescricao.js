const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

async function iniciarLoopDescricoes(interaction, textoSubtipos, nomeLista, sistema) {
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
        const erroMsg = '❌ Nenhum subtipo válido encontrado no formato `Tipo:Subtipo`. Tente novamente.';
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp({ content: erroMsg, flags: MessageFlags.Ephemeral });
        }
        return await interaction.reply({ content: erroMsg, flags: MessageFlags.Ephemeral });
    }

    if (!global.salvaguardaTempDesc) global.salvaguardaTempDesc = {};
    global.salvaguardaTempDesc[interaction.user.id] = {
        itens,
        acumulados: [],
        nomeLista,
        sistema
    };

    return pedirDescricaoIndex(interaction, itens, 0, nomeLista, sistema, []);
}

async function pedirDescricaoIndex(interaction, itens, indice, nomeLista, sistema, acumulados) {
    if (indice >= itens.length) {
        const { getDb } = require('../../database/dbConnection');
        const db = getDb();
        const stmt = db.prepare('INSERT INTO subtipos_salvaguarda (userId, sistema, nomeLista, tipo, subtipo, descricao) VALUES (?, ?, ?, ?, ?, ?)');
        
        const insertMany = db.transaction((arr) => {
            for (const item of arr) {
                stmt.run(interaction.user.id, sistema, nomeLista, item.tipo, item.subtipo, item.descricao);
            }
        });
        
        insertMany(acumulados);
        db.close();

        delete global.salvaguardaTempDesc[interaction.user.id];

        const { enviarMenuPrincipal } = require('../menu/sendMainMenu');
        const embedSucesso = new EmbedBuilder()
            .setTitle('✅ Lista Criada com Sucesso!')
            .setDescription(`A lista **"${nomeLista}"** foi salva com **${acumulados.length}** subtipos!`)
            .setColor(0x57F287);

        if (interaction.isButton() || interaction.isModalSubmit()) {
            await interaction.update({ embeds: [embedSucesso], components: [] }).catch(async () => {
                await interaction.followUp({ embeds: [embedSucesso], flags: MessageFlags.Ephemeral }).catch(() => {});
            });
        }
        return enviarMenuPrincipal(interaction, nomeLista, sistema);
    }

    const atual = itens[indice];
    global.salvaguardaTempDesc[interaction.user.id].tipoAtual = atual.tipo;
    global.salvaguardaTempDesc[interaction.user.id].subtipoAtual = atual.subtipo;

    const embed = new EmbedBuilder()
        .setTitle(`📝 Descrição do Subtipo (${indice + 1}/${itens.length})`)
        .setDescription(
            `Tipo: **${atual.tipo}**\nSubtipo: **${atual.subtipo}**\n\n` +
            `Clique no botão abaixo para digitar a descrição.\n\n` +
            `💡 **Exemplo de como preencher:**\n` +
            `> **Físico: Cinético / Balístico**\n` +
            `> **Descrição:** O que engloba: Golpes físicos diretos, projéteis, disparos, lâminas, pancadas e telecinese focada em impacto físico.\n` +
            `> Defesa padrão comum: Esquiva, Destreza, Reflexos ou Classe de Armadura (CA).`
        )
        .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`btn_pedir_desc_${indice}_${nomeLista}_${sistema}`)
            .setLabel('Digitar Descrição')
            .setStyle(ButtonStyle.Primary)
    );

    // Se a interação aceita update (botão/modal), atualizamos a mensagem existente sem dar timeout
    if (interaction.isButton() || interaction.isModalSubmit()) {
        return await interaction.update({ embeds: [embed], components: [row] }).catch(async () => {
            return await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
        });
    }

    if (interaction.replied || interaction.deferred) {
        return await interaction.followUp({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    } else {
        return await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    }
}

module.exports = { iniciarLoopDescricoes, pedirDescricaoIndex };