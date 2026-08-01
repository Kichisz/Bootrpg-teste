const { SlashCommandBuilder } = require('discord.js');
const criarCmd = require('./avatar/criar');
const verCmd = require('./avatar/ver');
const editarCmd = require('./avatar/editar');
const deletarCmd = require('./avatar/deletar');
const ativarCmd = require('./avatar/ativar');
const setupCmd = require('./avatar/setup');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Comandos de gerenciamento de avatares'),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'criar') return criarCmd(interaction);
        if (subcommand === 'ver') return verCmd(interaction);
        if (subcommand === 'editar') return editarCmd(interaction);
        if (subcommand === 'deletar') return deletarCmd(interaction);
        if (subcommand === 'ativar') return ativarCmd(interaction);
        if (subcommand === 'setup') return setupCmd(interaction);
    }
};