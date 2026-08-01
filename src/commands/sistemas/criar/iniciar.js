const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const sessionManager = require('./sessionManager');

module.exports = async function(interaction) {
    sessionManager.getSession(interaction.user.id); // Garante que a sessão existe limpa/criada
    // Se no seu sessionManager o método for setSession, mantenha assim:
    if (typeof sessionManager.setSession === 'function') {
        sessionManager.setSession(interaction.user.id, { step: 1, data: {} });
    }
    const session = sessionManager.getSession(interaction.user.id);

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛠️ Criação de Sistema de RPG — Passo 1/x')
        .setDescription(
            'Bem-vindo ao assistente de criação de sistemas! Vamos estruturar o seu RPG do zero de forma totalmente personalizada.\n\n' +
            'Para começarmos, qual é a **categoria ou o estilo principal** do seu sistema de regras?\n\n' +
            '💡 *Exemplo: D&D 5e (Fantasia Medieval), Vampiro a Máscara (Terror Urbano), Call of Cthulhu (Investigação Sobrenatural).*'
        )
        .setFooter({ text: 'Selecione abaixo para prosseguir.' });

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('rpg_setup_estilo_inicial')
            .setPlaceholder('Escolha o estilo/modelo base...')
            .addOptions([
                { label: 'Fantasia Medieval / Heroico (Ex: D&D, Tormenta)', value: 'fantasia' },
                { label: 'Moderno / Investigativo (Ex: Cthulhu, Ordem Paranormal)', value: 'moderno' },
                { label: 'Sombrio / Terror / Urbano (Ex: Vampiro, World of Darkness)', value: 'terror' },
                { label: 'Sci-Fi / Futurista / Espacial (Ex: Starfinder, Cyberpunk)', value: 'scifi' },
                { label: 'Outro / Personalizado Livre', value: 'outro' }
            ])
    );

    // ADICIONADO: ephemeral: true para aparecer apenas para quem usou o comando
    const reply = await interaction.reply({ 
        embeds: [embed], 
        components: [row], 
        ephemeral: true, 
        fetchReply: true 
    });
    
    sessionManager.salvarMensagemAtual(session, reply);
};