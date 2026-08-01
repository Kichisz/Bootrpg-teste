const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const { token } = require('./config');

// Importa os comandos
const fichaCommand = require('./commands/fichas/fichaIndex');
const sistemasCommand = require('./commands/sistemas/sistemas'); 
const criadorCommand = require('./commands/criador/criadorIndex');
const inimigoCommand = require('./commands/criador/inimigoIndex');
const npcCommand = require('./commands/criador/npcIndex');
const avatarCommand = require('./commands/avatar'); 
const messageHandler = require('./handlers/messageHandler'); 
const tabelasCommand = require('./commands/Tabelas/tabelas'); 
const inventarioCommand = require('./commands/inventario/inventario'); 
const subtiposIndex = require('./commands/salvaguarda/subtipos/index'); // Inicia o comando /salvaguarda subtipos
const subtiposRouter = require('./commands/salvaguarda/subtipos/handlerRouter'); // Contém o handleSalvaguardaInteraction

// 👈 Importações cirúrgicas do novo sistema /salvaguarda configurar
const { iniciarConfiguracaoSalvaguarda } = require('./commands/salvaguarda/rolls/configCommandEntry');
const { verificarSobrescricao } = require('./commands/salvaguarda/rolls/overwriteCheckModal');
const { iniciarSelecaoComponentes } = require('./commands/salvaguarda/rolls/componentSelectionMenu');
const { solicitarDado } = require('./commands/salvaguarda/rolls/diceInputHandler');
const { solicitarAtributo } = require('./commands/salvaguarda/rolls/attributeInputHandler');
const { solicitarPericia } = require('./commands/salvaguarda/rolls/skillInputHandler');
const { solicitarValorFixo } = require('./commands/salvaguarda/rolls/fixedValueInputHandler');
const { processarSistemaCa } = require('./commands/salvaguarda/rolls/acInputHandler');
const { perguntarTipoCalculoTotal } = require('./commands/salvaguarda/rolls/calculationTypeMenu');
const { perguntarModoDado } = require('./commands/salvaguarda/rolls/diceQuantityOrMaxValueHandler');
const { salvarConfiguracaoFinal } = require('./commands/salvaguarda/rolls/saveConfiguration');

// Armazenamento temporário em memória para o fluxo de configuração de salvaguarda por texto
const salvaguardaConfigTemp = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('clientReady', readyClient => {
    console.log(`Bot online como ${readyClient.user.tag}!`);
});

// Manipulador de interações (Slash Commands, Botões, Select Menus, Modais)
client.on('interactionCreate', async interaction => {
    try {
        const handledFicha = await fichaCommand.handleFichaInteractions(interaction);
        if (handledFicha) return;

        if (sistemasCommand && typeof sistemasCommand.handleInteractions === 'function') {
            const handledSistemas = await sistemasCommand.handleInteractions(interaction);
            if (handledSistemas) return;
        }

        if (criadorCommand && typeof criadorCommand.handleInteractions === 'function') {
            const handledCriador = await criadorCommand.handleInteractions(interaction);
            if (handledCriador) return;
        }

        if (inimigoCommand && typeof inimigoCommand.handleInteractions === 'function') {
            const handledInimigo = await inimigoCommand.handleInteractions(interaction);
            if (handledInimigo) return;
        }

        if (npcCommand && typeof npcCommand.handleInteractions === 'function') {
            const handledNpc = await npcCommand.handleInteractions(interaction);
            if (handledNpc) return;
        }

        if (avatarCommand && typeof avatarCommand.handleInteractions === 'function') {
            const handledAvatar = await avatarCommand.handleInteractions(interaction);
            if (handledAvatar) return;
        }

        if (tabelasCommand && typeof tabelasCommand.handleInteractions === 'function') {
            const handledTabelas = await tabelasCommand.handleInteractions(interaction);
            if (handledTabelas) return;
        }

        if (inventarioCommand && typeof inventarioCommand.handleInteractions === 'function') {
            const handledInventario = await inventarioCommand.handleInteractions(interaction);
            if (handledInventario) return;
        }

        // 👈 Tratamento cirúrgico das interações do novo sistema /salvaguarda configurar
        if (interaction.isStringSelectMenu() && interaction.customId === 'salv_config_select_subtipo') {
            const subtipoChave = interaction.values[0];
            return await verificarSobrescricao(interaction, subtipoChave);
        }

        if (interaction.isButton() && interaction.customId.startsWith('salv_over_sim_')) {
            const subtipoChave = interaction.customId.replace('salv_over_sim_', '');
            return await iniciarSelecaoComponentes(interaction, subtipoChave);
        }

        if (interaction.isButton() && interaction.customId.startsWith('salv_over_nao_')) {
            return interaction.update({ content: '❌ Configuração cancelada.', embeds: [], components: [] });
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('salv_comp_select_')) {
            const subtipoChave = interaction.customId.replace('salv_comp_select_', '');
            const selecionados = interaction.values;
            
            // Ordena para garantir que rolagem de dados venha primeiro se existir
            selecionados.sort((a, b) => (a === 'rolagem_dados' ? -1 : 1));

            salvaguardaConfigTemp.set(interaction.user.id, {
                subtipoChave,
                componentes: selecionados,
                indiceAtual: 0,
                dadosConfigFinal: {}
            });

            const primeiroComp = selecionados[0];
            const estado = salvaguardaConfigTemp.get(interaction.user.id);

            if (primeiroComp === 'rolagem_dados') return await solicitarDado(interaction, subtipoChave);
            if (primeiroComp === 'atributos') return await solicitarAtributo(interaction, subtipoChave);
            if (primeiroComp === 'pericias') return await solicitarPericia(interaction, subtipoChave);
            if (primeiroComp === 'valor_fixo') return await solicitarValorFixo(interaction, subtipoChave);
            if (primeiroComp === 'sistema_ca') {
                processarSistemaCa(estado.dadosConfigFinal);
                estado.indiceAtual++;
                return await prosseguirFluxoComponentes(interaction, estado);
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('salv_calc_tipo_')) {
            const subtipoChave = interaction.customId.replace('salv_calc_tipo_', '');
            const valorCalculo = interaction.values[0];
            const estado = salvaguardaConfigTemp.get(interaction.user.id) || { dadosConfigFinal: {}, subtipoChave };
            estado.dadosConfigFinal.tipoCalculo = valorCalculo;

            if (valorCalculo === 'dado_desafio') {
                return await perguntarModoDado(interaction, subtipoChave);
            } else {
                return await salvarConfiguracaoFinal(interaction, subtipoChave, estado.dadosConfigFinal);
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('salv_modo_dado_')) {
            const subtipoChave = interaction.customId.replace('salv_modo_dado_', '');
            const modoDado = interaction.values[0];
            const estado = salvaguardaConfigTemp.get(interaction.user.id) || { dadosConfigFinal: {}, subtipoChave };
            estado.dadosConfigFinal.modoDadoDesafio = modoDado;

            return await salvarConfiguracaoFinal(interaction, subtipoChave, estado.dadosConfigFinal);
        }

        // 👈 Tratamento correto usando a função que existe no seu handlerRouter.js
        if (subtiposRouter && typeof subtiposRouter.handleSalvaguardaInteraction === 'function') {
            const handledSub = await subtiposRouter.handleSalvaguardaInteraction(interaction);
            if (handledSub) return;
        }

        // 3. Se for um comando de barra (Slash Command)
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ficha') {
                return await fichaCommand.execute(interaction);
            }
            if (interaction.commandName === 'sistemas') {
                return await sistemasCommand.execute(interaction);
            }
            if (interaction.commandName === 'criador') {
                return await criadorCommand.execute(interaction);
            }
            if (interaction.commandName === 'inimigos') {
                return await inimigoCommand.execute(interaction);
            }
            if (interaction.commandName === 'npcs') {
                return await npcCommand.execute(interaction);
            }
            if (interaction.commandName === 'avatar') {
                return await avatarCommand.execute(interaction);
            }
            if (interaction.commandName === 'tabelas') {
                return await tabelasCommand.execute(interaction);
            }
            if (interaction.commandName === 'inventario') { 
                return await inventarioCommand.execute(interaction);
            }
            
            // 👈 Executa o comando /salvaguarda subtipos ou /salvaguarda configurar
            if (interaction.commandName === 'salvaguarda') {
                const subcmd = interaction.options.getSubcommand();
                if (subcmd === 'subtipos') {
                    if (subtiposIndex && typeof subtiposIndex.iniciarSubtipos === 'function') {
                        const sessionManager = require('./commands/salvaguarda/subtipos/sessionManager');
                        let session = sessionManager && typeof sessionManager.getSession === 'function' ? sessionManager.getSession(interaction.user.id) : null;
                        if (!session && sessionManager && typeof sessionManager.createSession === 'function') {
                            session = sessionManager.createSession(interaction.user.id);
                        }
                        return await subtiposIndex.iniciarSubtipos(interaction, session);
                    } else if (subtiposIndex && typeof subtiposIndex.execute === 'function') {
                        return await subtiposIndex.execute(interaction);
                    }
                } else if (subcmd === 'configurar') {
                    return await iniciarConfiguracaoSalvaguarda(interaction);
                }
            }
        }
    } catch (error) {
        console.error('Erro ao processar interação:', error);
        const errPayload = { content: '❌ Ocorreu um erro ao processar esta interação.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errPayload).catch(() => {});
        } else {
            await interaction.reply(errPayload).catch(() => {});
        }
    }
});

// Função auxiliar para avançar no array de múltiplos componentes escolhidos
async function prosseguirFluxoComponentes(messageOrInteraction, estado) {
    estado.indiceAtual++;
    if (estado.indiceAtual < estado.componentes.length) {
        const proximoComp = estado.componentes[estado.indiceAtual];
        const sub = estado.subtipoChave;

        const payloadText = 
            proximoComp === 'rolagem_dados' ? '🎲 Informe a rolagem de dados (ex: `1d6`):' :
            proximoComp === 'atributos' ? '📊 Informe o nome do Atributo:' :
            proximoComp === 'pericias' ? '🎯 Informe o nome da Perícia:' :
            proximoComp === 'valor_fixo' ? '📌 Informe o valor fixo numérico:' : null;

        if (payloadText) {
            if (messageOrInteraction.reply) {
                return messageOrInteraction.reply({ content: payloadText, ephemeral: true });
            } else {
                return messageOrInteraction.channel.send({ content: `<@${messageOrInteraction.author.id}>, ${payloadText}` });
            }
        }
    }

    // Se acabaram os componentes, pergunta o tipo de cálculo final
    return perguntarTipoCalculoTotalMsg(messageOrInteraction, estado.subtipoChave);
}

async function perguntarTipoCalculoTotalMsg(messageOrInteraction, subtipoChave) {
    const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`salv_calc_tipo_${subtipoChave}`)
        .setPlaceholder('Escolha o tipo de cálculo...')
        .addOptions([
            { label: 'Valor fixo que o inimigo deve ultrapassar', value: 'valor_fixo_inimigo', description: 'Ex: Valor total estático' },
            { label: 'Gerar dado com o valor total (Ex: 5d10)', value: 'dado_desafio', description: 'Ex: Soma vira modificador de dado' }
        ]);
    const row = new ActionRowBuilder().addComponents(selectMenu);

    const payload = { content: '🧮 **O número total vai ser valor fixo ou gerará um dado de desafio?**', components: [row] };
    if (messageOrInteraction.reply) {
        return messageOrInteraction.reply({ ...payload, ephemeral: true });
    } else {
        return messageOrInteraction.channel.send({ content: `<@${messageOrInteraction.author.id}>`, ...payload });
    }
}

// Manipulador de mensagens de texto
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    try {
        // 👈 Captura respostas de texto do fluxo de configuração de salvaguarda
        const estadoConfig = salvaguardaConfigTemp.get(message.author.id);
        if (estadoConfig && estadoConfig.componentes && estadoConfig.indiceAtual < estadoConfig.componentes.length) {
            const compAtual = estadoConfig.componentes[estadoConfig.indiceAtual];
            const texto = message.content.trim();

            if (compAtual === 'rolagem_dados') estadoConfig.dadosConfigFinal.rolagemDados = texto;
            if (compAtual === 'atributos') estadoConfig.dadosConfigFinal.atributo = texto;
            if (compAtual === 'pericias') estadoConfig.dadosConfigFinal.pericia = texto;
            if (compAtual === 'valor_fixo') estadoConfig.dadosConfigFinal.valorFixo = Number(texto) || texto;

            await message.react('✅').catch(() => {});
            return await prosseguirFluxoComponentes(message, estadoConfig);
        }

        await messageHandler(message);
        await fichaCommand.handleFichaMessages(message);
        
        if (sistemasCommand && typeof sistemasCommand.handleSistemasMessages === 'function') {
            await sistemasCommand.handleSistemasMessages(message);
        }
        if (criadorCommand && typeof criadorCommand.handleMessages === 'function') {
            const handledCriadorMsg = await criadorCommand.handleMessages(message);
            if (handledCriadorMsg) return;
        }

        if (inventarioCommand && typeof inventarioCommand.handleMessages === 'function') {
            const handledInventarioMsg = await inventarioCommand.handleMessages(message);
            if (handledInventarioMsg) return;
        }

        if (subtiposIndex && typeof subtiposIndex.processarSubtiposTexto === 'function') {
            const sessionManager = require('./commands/salvaguarda/subtipos/sessionManager');
            const session = sessionManager && typeof sessionManager.getSession === 'function' ? sessionManager.getSession(message.author.id) : null;
            if (session && (session.waitingForSubtiposCriar || session.waitingForSubtiposEditar)) {
                const handledSubMsg = await subtiposIndex.processarSubtiposTexto(message, session);
                if (handledSubMsg) return;
            }
        }
    } catch (error) {
        console.error('Erro ao processar mensagem de texto:', error);
    }
});

client.login(token);