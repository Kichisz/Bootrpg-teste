const { EmbedBuilder } = require('discord.js');

async function exibir(interaction, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('✏️ Passo 3/12 — Nome do Personagem')
        .setDescription(
            `Avatar vinculado: **${session.data.avatarNome || 'Nenhum'}**\n\n` +
            'Agora precisamos definir o nome oficial do seu personagem no universo do RPG.\n\n' +
            '💡 **Dica**: Esse nome aparecerá no topo de suas rolagens e status. Envie apenas o nome desejado no chat abaixo:'
        );

    // Usa editReply para atualizar a mensagem anterior e remover os botões/menus do passo passado
    return await interaction.editReply({ embeds: [embed], components: [] });
}

async function processar(message, session) {
    session.data.nomePersonagem = message.content.trim();
    session.etapaAtual = 'nivel'; // Avança para a próxima etapa (Nível)

    const fichaNivel = require('./fichaNivel');
    if (typeof fichaNivel.iniciar === 'function') {
        return fichaNivel.iniciar(message, session);
    } else if (typeof fichaNivel.exibir === 'function') {
        return fichaNivel.exibir(message, session);
    }
}

module.exports = { 
    exibir, 
    processar 
};