const { EmbedBuilder } = require('discord.js');

async function pedirNome(interaction, session) {
    session.step = 'AGUARDANDO_NOME';

    const tipoNome = session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC';
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🤖 Criador de Fichas — Nome do ${tipoNome}`)
        .setDescription(`Qual o **nome** do ${tipoNome} que você deseja criar?\n\n*Envie o nome na sua próxima mensagem no chat.*`);

    await interaction.editReply({ embeds: [embed], components: [] });
}

async function processarNome(message, session) {
    const nome = message.content.trim();
    try { await message.delete(); } catch (e) {}

    if (!nome) return;
    session.data.nome = nome;

    const db = require('../../../database');
    const sys = db.prepare('SELECT * FROM rpg_systems WHERE id = ?').get(session.systemId);
    let systemConfig = {};
    try { systemConfig = JSON.parse(sys.config || '{}'); } catch (e) {}

    session.systemConfig = systemConfig;
    session.extraResourcesQueue = [];

    if (systemConfig.recursosExtras && Array.isArray(systemConfig.recursosExtras)) {
        session.extraResourcesQueue = [...systemConfig.recursosExtras];
    }

    const { pedirRecursoExtra } = require('./etapaRecursos');
    await pedirRecursoExtra(session);
}

module.exports = {
    pedirNome,
    processarNome
};