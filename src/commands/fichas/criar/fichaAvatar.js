const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const db = require('../../../database');
const fichaManager = require('../fichaManager');

function safeTruncate(str, maxLength = 100) {
    if (!str || typeof str !== 'string') return 'Avatar sem nome';
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}

async function exibir(interaction, session) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    let tuppers = [];

    try {
        tuppers = db.prepare('SELECT * FROM tuppers WHERE userId = ? AND (isGlobal = 1 OR guildId = ?)').all(userId, guildId);
    } catch (e) {
        tuppers = [];
    }

    // Filtra avatares que já possuem ficha criada neste sistema específico
    const sistemaAtual = session.sistemaNome;
    let avataresDisponiveis = [];

    try {
        const fichasExistentes = fichaManager.db.prepare('SELECT avatarNome FROM fichas WHERE userId = ? AND sistemaNome = ?').all(userId, sistemaAtual);
        const nomesComFicha = new Set(fichasExistentes.map(f => f.avatarNome));
        
        avataresDisponiveis = tuppers.filter(t => !nomesComFicha.has(t.nome));
    } catch (e) {
        avataresDisponiveis = tuppers;
    }

    const embed = new EmbedBuilder()
        .setTitle('👤 Selecionar Avatar para a Ficha')
        .setDescription('Escolha abaixo qual dos seus avatares será vinculado a esta ficha:')
        .setColor(0x5865F2);

    if (!avataresDisponiveis || avataresDisponiveis.length === 0) {
        embed.setDescription('❌ Todos os seus avatares já possuem uma ficha criada neste sistema, ou você não tem avatares disponíveis! Crie um novo avatar ou selecione outro sistema.');
        embed.setColor(0xED4245);
        
        if (interaction.replied || interaction.deferred) {
            return await interaction.editReply({ embeds: [embed], components: [] });
        }
        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ficha_select_avatar')
        .setPlaceholder('Selecione o avatar para a ficha...')
        .addOptions(
            avataresDisponiveis.slice(0, 25).map(t => {
                let displayName = safeTruncate(t.nome, 100);
                let desc = safeTruncate(`Prefixo: ${t.prefixo || 'Nenhum'}`, 100);

                return new StringSelectMenuOptionBuilder()
                    .setLabel(displayName)
                    .setDescription(desc)
                    .setValue(String(t.id));
            })
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
}

async function tratar(interaction, session) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'ficha_select_avatar') {
        return false;
    }

    await interaction.deferUpdate().catch(() => {});

    const userId = interaction.user.id;
    const tupperId = interaction.values[0];
    const tupper = db.prepare('SELECT * FROM tuppers WHERE id = ? AND userId = ?').get(tupperId, userId);

    if (!tupper) {
        const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription('Avatar não encontrado.').setColor(0xED4245);
        await interaction.editReply({ embeds: [errEmbed], components: [] });
        return true;
    }

    // Validação extra de segurança caso o usuário tente burlar
    const jaTemFicha = fichaManager.verificarFichaExistente(userId, tupper.nome, session.sistemaNome);
    if (jaTemFicha) {
        const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription('Este avatar já possui uma ficha cadastrada neste sistema!').setColor(0xED4245);
        await interaction.editReply({ embeds: [errEmbed], components: [] });
        return true;
    }

    // Salva os dados do avatar na sessão
    session.data.avatarId = tupper.id;
    session.data.avatarNome = tupper.nome;
    session.data.avatarUrl = tupper.fotoUrl;
    session.etapaAtual = 'nome';

    const fichaNome = require('./fichaNome');
    if (typeof fichaNome.exibir === 'function') {
        await fichaNome.exibir(interaction, session);
    }

    return true;
}

module.exports = {
    exibir,
    tratar
};