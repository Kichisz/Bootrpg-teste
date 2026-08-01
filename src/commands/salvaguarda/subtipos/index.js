const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { obterSistemaAtivo } = require('./utils/checkActiveSystem');
const { enviarMenuInicial } = require('./views/sendInitialChoice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('salvaguarda')
        .setDescription('Gerencia as salvaguardas e subtipos do RPG')
        .addSubcommand(sub =>
            sub.setName('subtipos')
                .setDescription('Gerencia as listas de subtipos de salvaguarda')
        ),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const sistema = obterSistemaAtivo();
        if (!sistema) {
            return interaction.editReply({
                content: '❌ Nenhum sistema RPG está ativo no momento. Peça a um GM para ativar um usando `/sistemas ativar`.'
            });
        }

        return enviarMenuInicial(interaction, sistema);
    }
};