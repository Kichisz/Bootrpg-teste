const { SlashCommandBuilder } = require('discord.js');
const sessionCriador = require('./criar/sessionCriador');
const stepConfigNome = require('./criar/stepConfigNome');
const stepConfigAtrib = require('./criar/stepConfigAtrib');
const stepConfigPericia = require('./criar/stepConfigPericia');
const verHandler = require('./ver');
const deletarHandler = require('./deletar');
const criarfichaIndex = require('./criarficha/criarfichaIndex');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('criador')
        .setDescription('Sistema de criação de NPCs e Inimigos')
        .addSubcommand(sub =>
            sub.setName('configurar')
               .setDescription('Configura os parâmetros de limites para geração de NPCs')
        )
        .addSubcommand(sub =>
            sub.setName('ver')
               .setDescription('Visualiza e inspeciona as configurações de NPCs criadas')
        )
        .addSubcommand(sub =>
            sub.setName('deletar')
               .setDescription('Deleta uma configuração de NPCs criada por você')
        )
        .addSubcommand(sub =>
            sub.setName('criar')
               .setDescription('Cria automaticamente um NPC ou Inimigo utilizando IA')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'configurar') {
            const session = sessionCriador.getSession(interaction.user.id);
            sessionCriador.carregarSistemaAtivo(session, interaction.guild.id);
            return await stepConfigNome.iniciarConfiguracao(interaction);
        }

        if (subcommand === 'criar') {
            return await criarfichaIndex.iniciarCriacao(interaction);
        }

        if (subcommand === 'ver') {
            return await verHandler.listarConfiguracoes(interaction);
        }

        if (subcommand === 'deletar') {
            return await deletarHandler.deletarConfiguracao(interaction);
        }
    },

    async handleInteractions(interaction) {
        if (interaction.customId?.startsWith('criarficha_')) {
            return await criarfichaIndex.handleInteractions(interaction);
        }

        if (!interaction.isStringSelectMenu()) return false;

        if (interaction.customId === 'criador_ver_detalhes') {
            return await verHandler.lidarComDetalhes(interaction);
        }

        if (interaction.customId === 'criador_deletar_select') {
            return await deletarHandler.lidarComDelecao(interaction);
        }

        return false;
    },

    async handleMessages(message) {
        if (!message.guild || message.author.bot) return false;

        if (await criarfichaIndex.handleMessages(message)) return true;
        
        const session = sessionCriador.getSession(message.author.id);
        
        // Se a sessão não tem um passo ativo explícito, ignora completamente
        if (!session || !session.step) return false;

        // TRAVA DE SEGURANÇA: Se a sessão ficou presa na memória sem contexto ativo real, limpa o step e ignora
        if (!session.interactionRef && !session.guildId) {
            session.step = null;
            return false;
        }

        if (session.step === 'AGUARDANDO_NOME') {
            await stepConfigNome.processarNome(message, session);
            return true;
        }

        if (session.step === 'ATRIB_MIN' || session.step === 'ATRIB_MAX') {
            await stepConfigAtrib.processarAtributos(message, session);
            return true;
        }

        if (session.step === 'PERICIA_MIN' || session.step === 'PERICIA_MAX') {
            await stepConfigPericia.processarPericias(message, session);
            return true;
        }

        if (session.step === 'PV_MIN' || session.step === 'PV_MAX') {
            const texto = message.content.trim();
            try { await message.delete(); } catch (e) {}
            const val = Number(texto);
            if (isNaN(val)) {
                return message.channel.send({ content: '❌ Por favor, digite um número válido.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 4000));
            }
            if (session.step === 'PV_MIN') {
                session.data.pvMin = val;
            } else {
                session.data.pvMax = val;
            }
            await sessionCriador.avancarProximoPasso(message, session);
            return true;
        }

        if (session.step === 'PM_MIN' || session.step === 'PM_MAX') {
            const texto = message.content.trim();
            try { await message.delete(); } catch (e) {}
            const val = Number(texto);
            if (isNaN(val)) {
                return message.channel.send({ content: '❌ Por favor, digite um número válido.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 4000));
            }
            if (session.step === 'PM_MIN') {
                session.data.pmMin = val;
            } else {
                session.data.pmMax = val;
            }
            await sessionCriador.avancarProximoPasso(message, session);
            return true;
        }

        if (session.step === 'CA_VALOR') {
            const texto = message.content.trim();
            try { await message.delete(); } catch (e) {}
            session.data.caValor = Number(texto) || texto;
            await sessionCriador.avancarProximoPasso(message, session);
            return true;
        }

        if (session.step === 'RECURSOS') {
            const texto = message.content.trim().toLowerCase();
            try { await message.delete(); } catch (e) {}

            if (texto === 'ok') {
                const chavesPreenchidas = Object.keys(session.data || {}).length;
                if (chavesPreenchidas === 0) {
                    await message.channel.send({ 
                        content: '⚠️ O sistema não possui variáveis ativas configuradas. Preencha ao menos uma etapa antes de finalizar.' 
                    }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
                    return true;
                }

                const salvarConfigDb = require('./criar/salvarConfigDb');
                await salvarConfigDb.finalizar(message, session);
            }
            return true;
        }

        return false;
    }
};