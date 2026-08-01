const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const path = require('path');

// Caminhos corrigidos relativos a src/commands/fichas/
const fichaCriarIndex = require('./criar/fichaCriarIndex');
const fichaDeletar = require('./fichaDeletar');
const fichaVer = require('./fichaVer');
const fichaEditar = require('./fichaEditar');

const data = new SlashCommandBuilder()
    .setName('ficha')
    .setDescription('Gerenciamento de fichas de RPG')
    .addSubcommand(subcommand =>
        subcommand
            .setName('criar')
            .setDescription('Criar uma nova ficha de personagem de forma interativa (Visível no chat)')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('deletar')
            .setDescription('Deletar uma ou mais fichas de personagem existentes de forma privada')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('ver')
            .setDescription('Visualiza os detalhes completos de uma ou mais fichas de personagem de forma privada')
            .addUserOption(option =>
                option
                    .setName('usuario')
                    .setDescription('Marque o membro (@) cuja ficha deseja visualizar')
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('editar')
            .setDescription('Editar atributos, perícias, nível, vida, mana, CA e equipamentos de uma ficha de forma privada')
    );

async function execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    try {
        const subcommand = interaction.options?.getSubcommand ? interaction.options.getSubcommand() : null;

        if (subcommand === 'criar') {
            if (typeof fichaCriarIndex?.iniciarCriacao !== 'function') {
                throw new Error("A função 'iniciarCriacao' não foi exportada corretamente em fichaCriarIndex.");
            }
            return await fichaCriarIndex.iniciarCriacao(interaction);
        } else if (subcommand === 'deletar') {
            if (typeof fichaDeletar?.iniciarDelecao !== 'function') {
                throw new Error("A função 'iniciarDelecao' não foi exportada corretamente em fichaDeletar.");
            }
            return await fichaDeletar.iniciarDelecao(interaction);
        } else if (subcommand === 'ver') {
            if (typeof fichaVer?.verFichaComando !== 'function') {
                throw new Error("A função 'verFichaComando' não foi exportada corretamente em fichaVer.");
            }
            return await fichaVer.verFichaComando(interaction);
        } else if (subcommand === 'editar') {
            if (typeof fichaEditar?.iniciarEdicao !== 'function') {
                throw new Error("A função 'iniciarEdicao' não foi exportada corretamente em fichaEditar.");
            }
            return await fichaEditar.iniciarEdicao(interaction);
        } else {
            return await interaction.reply({
                content: '❌ Subcomando não reconhecido.',
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error('Erro ao executar o comando /ficha:', error);
        const errorPayload = {
            content: `❌ Ocorreu um erro interno: ${error.message}`,
            flags: MessageFlags.Ephemeral
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorPayload).catch(() => {});
        } else {
            await interaction.reply(errorPayload).catch(() => {});
        }
    }
}

async function handleFichaInteractions(interaction) {
    try {
        if (fichaEditar && typeof fichaEditar.tratarInteracao === 'function') {
            const handledEditar = await fichaEditar.tratarInteracao(interaction);
            if (handledEditar) return true;
        }

        if (fichaDeletar && typeof fichaDeletar.tratarInteracao === 'function') {
            const handledDeletar = await fichaDeletar.tratarInteracao(interaction);
            if (handledDeletar) return true;
        }

        if (!fichaCriarIndex?.sessoesCriacao) return false;
        const session = fichaCriarIndex.sessoesCriacao.get(interaction.user.id);
        if (!session) return false;
        if (typeof fichaCriarIndex.tratarInteracaoEtapa === 'function') {
            return await fichaCriarIndex.tratarInteracaoEtapa(interaction, session);
        }
        return false;
    } catch (error) {
        console.error('Erro em handleFichaInteractions:', error);
        return false;
    }
}

async function handleFichaMessages(message) {
    try {
        if (fichaEditar?.sessoesEdicao && fichaEditar.sessoesEdicao.has(message.author.id)) {
            const session = fichaEditar.sessoesEdicao.get(message.author.id);
            if (typeof fichaEditar.processarTextoEdicao === 'function') {
                return await fichaEditar.processarTextoEdicao(message, session);
            }
        }

        if (!fichaCriarIndex?.sessoesCriacao) return false;
        const session = fichaCriarIndex.sessoesCriacao.get(message.author.id);
        if (!session) return false;
        if (typeof fichaCriarIndex.tratarTextoEtapa === 'function') {
            return await fichaCriarIndex.tratarTextoEtapa(message, session);
        }
        return false;
    } catch (error) {
        console.error('Erro em handleFichaMessages:', error);
        return false;
    }
}

module.exports = {
    data,
    execute,
    handleFichaInteractions,
    handleFichaMessages
};