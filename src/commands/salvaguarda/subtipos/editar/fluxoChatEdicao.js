const { EmbedBuilder, MessageFlags } = require('discord.js');
const { getDb } = require('../database/dbConnection');
const { enviarMenuPrincipal } = require('../menu/sendMainMenu');

async function executarFluxoChatEdicao(interaction, subId, campo, nomeLista, sistema) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
    }

    const embedPrompt = new EmbedBuilder()
        .setTitle('✏️ Edição de Subtipo')
        .setDescription(
            `Digite no chat o **novo valor** para ${campo === 'editar_nome' ? '**o Tipo e o Subtipo** (Ex: *Físico: Cinético*)' : '**a Descrição**'}:`
        )
        .setColor(0x5865F2);

    await interaction.followUp({ embeds: [embedPrompt], flags: MessageFlags.Ephemeral }).catch(() => {});

    const filter = m => m.author.id === interaction.user.id;
    try {
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60_000, errors: ['time'] });
        const msg = collected.first();
        await msg.delete().catch(() => {});

        const novoValor = msg.content.trim();
        const db = getDb();

        if (campo === 'editar_nome') {
            const [t, s] = novoValor.split(':').map(x => x ? x.trim() : '');
            if (t && s) {
                db.prepare('UPDATE subtipos_salvaguarda SET tipo = ?, subtipo = ? WHERE id = ?').run(t, s, subId);
            }
        } else {
            db.prepare('UPDATE subtipos_salvaguarda SET descricao = ? WHERE id = ?').run(novoValor, subId);
        }
        db.close();

        return enviarMenuPrincipal(interaction, nomeLista, sistema);
    } catch {
        const embedErro = new EmbedBuilder().setTitle('⏳ Tempo Esgotado').setDescription('A edição foi cancelada.').setColor(0xED4245);
        await interaction.followUp({ embeds: [embedErro], flags: MessageFlags.Ephemeral }).catch(() => {});
    }
}

module.exports = { executarFluxoChatEdicao };