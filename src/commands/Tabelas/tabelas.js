const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const criarHandler = require('./criar/criarHandler');
const verHandler = require('./ver/verHandler');
const editarHandler = require('./editar/editarHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tabelas')
        .setDescription('Sistema de tabelas de itens pré-criados')
        .addSubcommand(sub => sub.setName('criar').setDescription('Criar um novo item, arma ou armadura'))
        .addSubcommand(sub => sub.setName('ver').setDescription('Ver itens criados para o sistema ativo'))
        .addSubcommand(sub => sub.setName('editar').setDescription('Editar ou excluir itens existentes')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'criar') return criarHandler(interaction);
        if (subcommand === 'ver') return verHandler(interaction);
        if (subcommand === 'editar') return editarHandler(interaction);
    }
};