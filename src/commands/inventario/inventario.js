const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const configurarHandler = require('./inventarioConfig');
const editarHandler = require('./editar/editarHandler');
const verHandler = require('./ver/verHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventario')
        .setDescription('Gerenciamento de inventário dos personagens')
        .addSubcommand(sub =>
            sub.setName('configurar')
                .setDescription('Configura o inventário (peso ou quantia)')
                .addStringOption(opt =>
                    opt.setName('tipo')
                        .setDescription('Tipo de configuração (opcional)')
                        .setRequired(false) // <--- Alterado para false para aceitar sem o parâmetro
                        .addChoices(
                            { name: 'Peso', value: 'peso' },
                            { name: 'Quantia', value: 'quantia' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('editar')
                .setDescription('[GM] Edita o inventário de um personagem')
                .addUserOption(opt =>
                    opt.setName('usuario')
                        .setDescription('Usuário dono do inventário')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('ver')
                .setDescription('Visualiza o inventário do seu personagem ativo ou de outro (GM)')
                .addUserOption(opt =>
                    opt.setName('usuario')
                        .setDescription('Usuário cuja ficha deseja ver (Apenas GMs)')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'configurar') return configurarHandler.execute(interaction);
        if (subcommand === 'editar') return editarHandler(interaction);
        if (subcommand === 'ver') return verHandler(interaction);
    },

    async handleInteractions(interaction) {
        if (await configurarHandler.handleInteractions?.(interaction)) return true;
        if (await editarHandler.handleInteractions?.(interaction)) return true;
        if (await verHandler.handleInteractions?.(interaction)) return true;
        return false;
    },

    async handleMessages(message) {
        if (await configurarHandler.handleMessages?.(message)) return true;
        if (await editarHandler.handleMessages?.(message)) return true;
        if (await verHandler.handleMessages?.(message)) return true;
        return false;
    }
};