const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fichaManager = require('./fichaManager');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const sessoesEdicao = new Map();

function getSistemaConfig() {
    try {
        const activeDbPath = path.resolve('sistemaativo-database.sqlite');
        if (!fs.existsSync(activeDbPath)) return {};
        const activeDb = new Database(activeDbPath, { readonly: true });
        const row = activeDb.prepare('SELECT conteudo_json FROM sistema_ativo LIMIT 1').get();
        activeDb.close();
        if (row && row.conteudo_json) {
            return JSON.parse(row.conteudo_json);
        }
    } catch (err) {}
    return {};
}

async function iniciarEdicao(interaction) {
    const userId = interaction.user.id;
    let fichas = [];

    try {
        fichas = fichaManager.db.prepare('SELECT id, nomePersonagem, sistemaNome, avatarNome, dadosJson FROM fichas WHERE userId = ?').all(userId);
    } catch (e) {
        fichas = [];
    }

    const embed = new EmbedBuilder()
        .setTitle('✏️ Editar Ficha de Personagem')
        .setDescription('Selecione abaixo qual ficha você deseja editar de forma privada:')
        .setColor(0x5865F2);

    if (!fichas || fichas.length === 0) {
        embed.setDescription('❌ Você não possui nenhuma ficha cadastrada para editar.');
        embed.setColor(0xED4245);
        if (interaction.replied || interaction.deferred) {
            return await interaction.editReply({ embeds: [embed], components: [] });
        }
        return await interaction.reply({ embeds: [embed], components: [], flags: [64] });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ficha_editar_selecionar_ficha')
        .setPlaceholder('Escolha a ficha para editar...')
        .addOptions(
            fichas.slice(0, 25).map(f => {
                let dados = {};
                try { dados = JSON.parse(f.dadosJson || '{}'); } catch(e){}
                const nome = dados.informacoesGerais?.nome || f.nomePersonagem || 'Personagem';
                const label = `${nome} (${f.sistemaNome})`;
                const desc = `Avatar: ${f.avatarNome}`;
                return new StringSelectMenuOptionBuilder()
                    .setLabel(label.length > 100 ? label.substring(0, 97) + '...' : label)
                    .setDescription(desc.length > 100 ? desc.substring(0, 97) + '...' : desc)
                    .setValue(String(f.id));
            })
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({ embeds: [embed], components: [row] });
    }
    return await interaction.reply({ embeds: [embed], components: [row], flags: [64] });
}

async function exibirMenuOpcoesEdicao(target, session) {
    const dados = session.dadosFicha;
    const info = dados.informacoesGerais || {};
    const nomeChar = info.nome || 'Personagem';
    const nivelChar = info.nivel || 1;

    session.etapaAtual = 'menu_principal';

    const embed = new EmbedBuilder()
        .setTitle(`✏️ Editando: ${nomeChar}`)
        .setDescription(`Nível atual: **${nivelChar}**\n\nSelecione abaixo qual categoria da ficha você deseja alterar:`)
        .setColor(0x5865F2);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ficha_editar_menu_opcao')
        .setPlaceholder('O que você deseja editar?')
        .addOptions([
            new StringSelectMenuOptionBuilder().setLabel('Nível do Personagem').setDescription('Alterar o nível atual').setValue('editar_nivel'),
            new StringSelectMenuOptionBuilder().setLabel('Atributos').setDescription('Modificar os valores dos atributos').setValue('editar_atributos'),
            new StringSelectMenuOptionBuilder().setLabel('Perícias').setDescription('Adicionar, remover ou alterar perícias e seus atributos').setValue('editar_pericias'),
            new StringSelectMenuOptionBuilder().setLabel('Pontos de Vida (PV)').setDescription('Alterar valor máximo e atual de PV').setValue('editar_pv'),
            new StringSelectMenuOptionBuilder().setLabel('Pontos de Mana (PM)').setDescription('Alterar valor máximo e atual de PM').setValue('editar_pm'),
            new StringSelectMenuOptionBuilder().setLabel('Classe de Armadura (CA)').setDescription('Modificar cálculo ou valor da CA').setValue('editar_ca'),
            new StringSelectMenuOptionBuilder().setLabel('Equipamentos (Arma / Armadura)').setDescription('Gerenciar armas e armaduras equipadas').setValue('editar_equipamentos')
        ]);

    const rowMenu = new ActionRowBuilder().addComponents(selectMenu);
    const rowBotoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ficha_editar_salvar_tudo').setLabel('💾 Salvar Alterações').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ficha_editar_cancelar').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
    );

    if (target.isCommand?.() || target.isStringSelectMenu?.() || target.isButton?.()) {
        if (target.replied || target.deferred) {
            return await target.editReply({ embeds: [embed], components: [rowMenu, rowBotoes] }).catch(() => {});
        } else {
            return await target.update({ embeds: [embed], components: [rowMenu, rowBotoes] }).catch(() => {});
        }
    } else if (target.channel) {
        return await target.channel.send({ embeds: [embed], components: [rowMenu, rowBotoes] }).catch(() => {});
    }
}

async function tratarInteracao(interaction) {
    const customId = interaction.customId;
    const userId = interaction.user.id;

    if (customId === 'ficha_editar_selecionar_ficha') {
        if (!interaction.isStringSelectMenu()) return false;
        await interaction.deferUpdate().catch(() => {});

        const fichaId = interaction.values[0];
        const registro = fichaManager.db.prepare('SELECT * FROM fichas WHERE id = ? AND userId = ?').get(fichaId, userId);

        if (!registro) {
            const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription('Ficha não encontrada.').setColor(0xED4245);
            await interaction.editReply({ embeds: [errEmbed], components: [] });
            return true;
        }

        let dadosObj = {};
        try { dadosObj = JSON.parse(registro.dadosJson || '{}'); } catch(e){}

        sessoesEdicao.set(userId, {
            fichaId: registro.id,
            sistemaNome: registro.sistemaNome,
            sistemaConfig: getSistemaConfig(),
            dadosFicha: dadosObj,
            etapaAtual: 'menu_principal'
        });

        await exibirMenuOpcoesEdicao(interaction, sessoesEdicao.get(userId));
        return true;
    }

    const session = sessoesEdicao.get(userId);
    if (!session) return false;

    if (customId === 'ficha_editar_cancelar') {
        if (!interaction.isButton()) return false;
        await interaction.deferUpdate().catch(() => {});
        sessoesEdicao.delete(userId);

        const cancelEmbed = new EmbedBuilder().setTitle('❌ Edição Cancelada').setDescription('Nenhuma alteração foi salva.').setColor(0xED4245);
        await interaction.editReply({ embeds: [cancelEmbed], components: [] });
        return true;
    }

    if (customId === 'ficha_editar_salvar_tudo') {
        if (!interaction.isButton()) return false;
        await interaction.deferUpdate().catch(() => {});

        try {
            const dadosStr = JSON.stringify(session.dadosFicha);
            const nomeChar = session.dadosFicha.informacoesGerais?.nome || 'Personagem';
            
            fichaManager.db.prepare('UPDATE fichas SET dadosJson = ?, nomePersonagem = ? WHERE id = ?').run(dadosStr, nomeChar, session.fichaId);

            const successEmbed = new EmbedBuilder()
                .setTitle('💾 Ficha Atualizada com Sucesso!')
                .setDescription(`As alterações na ficha de **${nomeChar}** foram salvas no banco de dados com sucesso!`)
                .setColor(0x57F287);

            await interaction.editReply({ embeds: [successEmbed], components: [] });
        } catch (e) {
            const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription('Ocorreu um erro ao salvar as alterações no banco de dados.').setColor(0xED4245);
            await interaction.editReply({ embeds: [errEmbed], components: [] });
        }

        sessoesEdicao.delete(userId);
        return true;
    }

    if (customId === 'ficha_editar_menu_opcao') {
        if (!interaction.isStringSelectMenu()) return false;
        await interaction.deferUpdate().catch(() => {});

        const escolha = interaction.values[0];

        if (escolha === 'editar_nivel') {
            session.etapaAtual = 'aguardando_nivel';
            const embed = new EmbedBuilder()
                .setTitle('📈 Editar Nível do Personagem')
                .setDescription(`Nível atual: **${session.dadosFicha.informacoesGerais?.nivel || 1}**\n\n💬 **Envie no chat o novo valor numérico do nível:**`)
                .setColor(0x5865F2);
            const btnVoltar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary));
            await interaction.editReply({ embeds: [embed], components: [btnVoltar] });
            return true;
        }

        if (escolha === 'editar_atributos') {
            session.etapaAtual = 'aguardando_atributos_menu';
            const atributos = session.dadosFicha.atributos || {};
            
            let listaAttrs = [];
            if (Array.isArray(atributos)) {
                listaAttrs = atributos;
            } else if (typeof atributos === 'object') {
                listaAttrs = Object.entries(atributos).map(([k, v]) => ({ nome: k, categoria: 'Fisicas', valor: v }));
            }

            let desc = listaAttrs.length > 0 
                ? listaAttrs.map(a => `• **${a.nome}** (${a.categoria}): \`${a.valor}\``).join('\n') 
                : 'Nenhum atributo cadastrado.';
            
            const embed = new EmbedBuilder()
                .setTitle('📊 Editar Atributos')
                .setDescription(`${desc}\n\n💬 **Envie no chat no formato \`Categoria: Nome: Valor\`** (ex: \`Fisicas: Força: 14\` ou apenas \`Força: 14\`):`)
                .setColor(0x5865F2);
            const btnVoltar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary));
            await interaction.editReply({ embeds: [embed], components: [btnVoltar] });
            return true;
        }

        if (escolha === 'editar_pericias') {
            session.etapaAtual = 'menu_pericias';
            return exibirMenuPericias(interaction, session);
        }

        if (escolha === 'editar_pv') {
            session.etapaAtual = 'aguardando_pv';
            const pv = session.dadosFicha.combate?.pv || { atual: 0, maximo: 0 };
            const embed = new EmbedBuilder()
                .setTitle('❤️ Editar Pontos de Vida (PV)')
                .setDescription(`PV Atual: **${pv.atual} / ${pv.maximo}**\n\n💬 **Envie no chat o novo valor máximo/atual do PV** (ou formato \`atual/maximo\`, ex: \`40/50\` ou apenas \`50\`):`)
                .setColor(0x5865F2);
            const btnVoltar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary));
            await interaction.editReply({ embeds: [embed], components: [btnVoltar] });
            return true;
        }

        if (escolha === 'editar_pm') {
            session.etapaAtual = 'aguardando_pm';
            const pm = session.dadosFicha.combate?.pm || { atual: 0, maximo: 0 };
            const embed = new EmbedBuilder()
                .setTitle('✨ Editar Pontos de Mana (PM)')
                .setDescription(`PM Atual: **${pm.atual} / ${pm.maximo}**\n\n💬 **Envie no chat o novo valor de PM** (ex: \`20/20\` ou apenas \`20\`):`)
                .setColor(0x5865F2);
            const btnVoltar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary));
            await interaction.editReply({ embeds: [embed], components: [btnVoltar] });
            return true;
        }

        if (escolha === 'editar_ca') {
            session.etapaAtual = 'aguardando_ca';
            const ca = session.dadosFicha.combate?.ca;
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Editar Classe de Armadura (CA)')
                .setDescription(`CA Atual cadastrada: \`${JSON.stringify(ca)}\`\n\n💬 **Envie no chat o novo valor fixo ou expressão da CA** (ex: \`15\`):`)
                .setColor(0x5865F2);
            const btnVoltar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary));
            await interaction.editReply({ embeds: [embed], components: [btnVoltar] });
            return true;
        }

        if (escolha === 'editar_equipamentos') {
            session.etapaAtual = 'menu_equipamentos';
            return exibirMenuEquipamentos(interaction, session);
        }
    }

    if (customId === 'ficha_editar_voltar_menu') {
        if (!interaction.isButton()) return false;
        await interaction.deferUpdate().catch(() => {});
        return await exibirMenuOpcoesEdicao(interaction, session);
    }

    if (customId.startsWith('ficha_editar_pericia_')) {
        return tratarInteracaoPericias(interaction, session);
    }

    if (customId.startsWith('ficha_editar_equip_')) {
        return tratarInteracaoEquipamentos(interaction, session);
    }

    return false;
}

async function exibirMenuPericias(target, session) {
    const pericias = session.dadosFicha.pericias || [];
    let listaPericias = [];
    
    if (Array.isArray(pericias)) {
        listaPericias = pericias;
    } else if (typeof pericias === 'object') {
        listaPericias = Object.entries(pericias).map(([k, v]) => ({ nome: k, ...(typeof v === 'object' ? v : { valorFixo: v }) }));
    }

    let textoDesc = listaPericias.length > 0 
        ? listaPericias.map(p => `• **${p.nome}** (Valor Fixo: \`${p.valorFixo !== undefined ? p.valorFixo : (p.valor || 0)}\` | Atributo: \`${p.atributoBase || 'Nenhum'}\`)`).join('\n')
        : 'Nenhuma perícia cadastrada.';

    const embed = new EmbedBuilder()
        .setTitle('🎯 Gerenciar Perícias')
        .setDescription(`${textoDesc}\n\nEscolha o que deseja fazer com as perícias:`)
        .setColor(0x5865F2);

    const rowMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ficha_editar_pericia_acao')
            .setPlaceholder('Selecione uma ação para perícias...')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Adicionar nova perícia').setDescription('Criar/adicionar nova perícia na ficha').setValue('adicionar'),
                new StringSelectMenuOptionBuilder().setLabel('Remover perícia existente').setDescription('Excluir uma perícia da ficha').setValue('remover'),
                new StringSelectMenuOptionBuilder().setLabel('Alterar atributos base / valor').setDescription('Modificar atributos vinculados ou valor de uma perícia').setValue('alterar')
            ])
    );

    const rowVoltar = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary)
    );

    if (target.isCommand?.() || target.isStringSelectMenu?.() || target.isButton?.()) {
        if (target.replied || target.deferred) {
            return await target.editReply({ embeds: [embed], components: [rowMenu, rowVoltar] }).catch(() => {});
        } else {
            return await target.update({ embeds: [embed], components: [rowMenu, rowVoltar] }).catch(() => {});
        }
    }
}

async function tratarInteracaoPericias(interaction, session) {
    if (!interaction.isStringSelectMenu()) return false;
    await interaction.deferUpdate().catch(() => {});

    const valor = interaction.values[0];

    if (valor === 'adicionar') {
        session.etapaAtual = 'aguardando_adicionar_pericia_nome';
        const embed = new EmbedBuilder()
            .setTitle('➕ Adicionar Nova Perícia')
            .setDescription('💬 **Envie no chat o nome da nova perícia** que deseja adicionar:')
            .setColor(0x5865F2);
        const btnVoltar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary));
        await interaction.editReply({ embeds: [embed], components: [btnVoltar] });
        return true;
    }

    if (valor === 'remover' || valor === 'alterar') {
        let pericias = session.dadosFicha.pericias || [];
        let lista = Array.isArray(pericias) ? pericias : Object.keys(pericias);

        if (lista.length === 0) {
            const embed = new EmbedBuilder().setTitle('❌ Aviso').setDescription('Não há perícias cadastradas para remover ou alterar.').setColor(0xED4245);
            const btnVoltar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary));
            await interaction.editReply({ embeds: [embed], components: [btnVoltar] });
            return true;
        }

        session.etapaAtual = valor === 'remover' ? 'aguardando_remover_pericia' : 'aguardando_alterar_pericia_escolha';
        
        const options = lista.slice(0, 25).map(p => {
            const nome = typeof p === 'string' ? p : p.nome;
            return new StringSelectMenuOptionBuilder().setLabel(nome.substring(0, 100)).setValue(nome);
        });

        const embed = new EmbedBuilder()
            .setTitle(valor === 'remover' ? '🗑️ Remover Perícia' : '✏️ Alterar Perícia')
            .setDescription('Selecione abaixo a perícia desejada:')
            .setColor(0x5865F2);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`ficha_editar_pericia_${valor}_select`)
                .setPlaceholder('Selecione a perícia...')
                .addOptions(options)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
        return true;
    }

    if (interaction.customId === 'ficha_editar_pericia_remover_select') {
        const periciaNome = interaction.values[0];
        if (Array.isArray(session.dadosFicha.pericias)) {
            session.dadosFicha.pericias = session.dadosFicha.pericias.filter(p => (typeof p === 'string' ? p : p.nome) !== periciaNome);
        } else if (typeof session.dadosFicha.pericias === 'object') {
            delete session.dadosFicha.pericias[periciaNome];
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ Perícia Removida')
            .setDescription(`A perícia **${periciaNome}** foi removida com sucesso!`)
            .setColor(0x57F287);
        const btnVoltar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary));
        await interaction.editReply({ embeds: [embed], components: [btnVoltar] });
        return true;
    }

    if (interaction.customId === 'ficha_editar_pericia_alterar_select') {
        session.periciaSendoAlterada = interaction.values[0];
        session.etapaAtual = 'aguardando_novo_valor_pericia';

        const embed = new EmbedBuilder()
            .setTitle(`✏️ Alterar Perícia: ${session.periciaSendoAlterada}`)
            .setDescription('💬 **Envie no chat o novo valor fixo ou nome do novo atributo base** para esta perícia:')
            .setColor(0x5865F2);
        const btnVoltar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary));
        await interaction.editReply({ embeds: [embed], components: [btnVoltar] });
        return true;
    }

    return false;
}

async function exibirMenuEquipamentos(target, session) {
    const eq = session.dadosFicha.inventarioEquipamentos || {};
    const arma = eq.arma?.nome || 'Nenhuma';
    const armadura = eq.armadura?.nome || 'Nenhuma';

    const embed = new EmbedBuilder()
        .setTitle('⚔️ Gerenciar Equipamentos')
        .setDescription(`• **Arma Equipada:** \`${arma}\`\n• **Armadura Equipada:** \`${armadura}\`\n\nO que deseja fazer?`)
        .setColor(0x5865F2);

    const rowMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ficha_editar_equip_acao')
            .setPlaceholder('Escolha uma opção...')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Editar Arma Equipada').setDescription('Alterar nome, dano ou bônus da arma').setValue('arma'),
                new StringSelectMenuOptionBuilder().setLabel('Editar Armadura Equipada').setDescription('Alterar nome, bônus de CA ou tipo da armadura').setValue('armadura')
            ])
    );

    const rowVoltar = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary)
    );

    if (target.isCommand?.() || target.isStringSelectMenu?.() || target.isButton?.()) {
        if (target.replied || target.deferred) {
            return await target.editReply({ embeds: [embed], components: [rowMenu, rowVoltar] }).catch(() => {});
        } else {
            return await target.update({ embeds: [embed], components: [rowMenu, rowVoltar] }).catch(() => {});
        }
    }
}

async function tratarInteracaoEquipamentos(interaction, session) {
    if (!interaction.isStringSelectMenu()) return false;
    await interaction.deferUpdate().catch(() => {});

    const tipo = interaction.values[0];
    session.etapaAtual = `aguardando_editar_${tipo}`;

    const embed = new EmbedBuilder()
        .setTitle(`✏️ Editar ${tipo === 'arma' ? 'Arma' : 'Armadura'}`)
        .setDescription(`💬 **Envie no chat no formato \`Nome | Dano/Bônus | Descrição\`** (Ex: \`Espada Longa | 1d8+2 | Espada afiada\`):`)
        .setColor(0x5865F2);
    const btnVoltar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ficha_editar_voltar_menu').setLabel('🔙 Voltar ao Menu').setStyle(ButtonStyle.Secondary));
    await interaction.editReply({ embeds: [embed], components: [btnVoltar] });
    return true;
}

async function processarTextoEdicao(message, session) {
    try { await message.delete(); } catch (e) {}
    const texto = message.content.trim();

    if (session.etapaAtual === 'aguardando_nivel') {
        const novoNivel = parseInt(texto) || 1;
        if (!session.dadosFicha.informacoesGerais) session.dadosFicha.informacoesGerais = {};
        session.dadosFicha.informacoesGerais.nivel = novoNivel;

        session.etapaAtual = 'menu_principal';
        return message.channel.send({ content: `✅ Nível atualizado para **${novoNivel}** com sucesso!` }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 4000);
            exibirMenuOpcoesEdicao(message, session);
        });
    }

    if (session.etapaAtual === 'aguardando_atributos_menu') {
        const partes = texto.split(':').map(p => p.trim());
        if (partes.length < 2) {
            return message.channel.send({ content: '❌ Formato inválido! Use `Categoria: Nome: Valor` ou apenas `Nome: Valor`.' }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 4000);
            });
        }

        let categoria = 'Fisicas';
        let nomeAttr = '';
        let valAttr = '';

        if (partes.length >= 3) {
            categoria = partes[0];
            nomeAttr = partes[1];
            valAttr = partes.slice(2).join(':').trim();
        } else {
            nomeAttr = partes[0];
            valAttr = partes[1];

            const sistemaConfig = session.sistemaConfig || getSistemaConfig();
            const atributosConfig = sistemaConfig.atributosConfig || [];
            const found = atributosConfig.find(ac => ac.nome && ac.nome.toLowerCase() === nomeAttr.toLowerCase());
            if (found && found.categoria) {
                categoria = found.categoria;
            }
        }

        if (!session.dadosFicha.atributos) session.dadosFicha.atributos = [];

        if (!Array.isArray(session.dadosFicha.atributos)) {
            const arr = [];
            for (const [k, v] of Object.entries(session.dadosFicha.atributos)) {
                const sistemaConfig = session.sistemaConfig || getSistemaConfig();
                const atributosConfig = sistemaConfig.atributosConfig || [];
                const found = atributosConfig.find(ac => ac.nome && ac.nome.toLowerCase() === k.toLowerCase());
                const catDefault = found?.categoria || 'Fisicas';

                if (typeof v === 'object' && v !== null) {
                    arr.push({ nome: k, categoria: v.categoria || catDefault, valor: v.valor !== undefined ? v.valor : v });
                } else {
                    arr.push({ nome: k, categoria: catDefault, valor: v });
                }
            }
            session.dadosFicha.atributos = arr;
        }

        const existingIndex = session.dadosFicha.atributos.findIndex(a => a.nome.toLowerCase() === nomeAttr.toLowerCase());
        if (existingIndex >= 0) {
            session.dadosFicha.atributos[existingIndex].valor = valAttr;
            session.dadosFicha.atributos[existingIndex].categoria = categoria;
        } else {
            session.dadosFicha.atributos.push({ nome: nomeAttr, categoria: categoria, valor: valAttr });
        }

        session.etapaAtual = 'menu_principal';
        return message.channel.send({ content: `✅ Atributo **${nomeAttr}** (${categoria}) atualizado para **${valAttr}**!` }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 4000);
            exibirMenuOpcoesEdicao(message, session);
        });
    }

    if (session.etapaAtual === 'aguardando_adicionar_pericia_nome') {
        session.novaPericiaNomeTemp = texto;
        session.etapaAtual = 'aguardando_adicionar_pericia_valor';
        return message.channel.send({ content: `💬 Agora envie o **valor fixo ou atributo base** para a perícia **${texto}**:` }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        });
    }

    if (session.etapaAtual === 'aguardando_adicionar_pericia_valor') {
        const nome = session.novaPericiaNomeTemp;
        if (!session.dadosFicha.pericias) session.dadosFicha.pericias = [];

        if (Array.isArray(session.dadosFicha.pericias)) {
            session.dadosFicha.pericias.push({ nome: nome, valorFixo: isNaN(texto) ? 0 : Number(texto), atributoBase: isNaN(texto) ? [texto] : [] });
        } else {
            session.dadosFicha.pericias[nome] = { valorFixo: isNaN(texto) ? 0 : Number(texto) };
        }

        delete session.novaPericiaNomeTemp;
        session.etapaAtual = 'menu_principal';
        return message.channel.send({ content: `✅ Perícia **${nome}** adicionada com sucesso!` }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 4000);
            exibirMenuOpcoesEdicao(message, session);
        });
    }

    if (session.etapaAtual === 'aguardando_novo_valor_pericia') {
        const nomePericia = session.periciaSendoAlterada;
        if (Array.isArray(session.dadosFicha.pericias)) {
            const p = session.dadosFicha.pericias.find(x => (typeof x === 'string' ? x : x.nome) === nomePericia);
            if (p) {
                if (typeof p === 'object') {
                    p.valorFixo = isNaN(texto) ? p.valorFixo : Number(texto);
                    if (isNaN(texto)) p.atributoBase = [texto];
                }
            }
        } else if (typeof session.dadosFicha.pericias === 'object') {
            if (session.dadosFicha.pericias[nomePericia]) {
                session.dadosFicha.pericias[nomePericia] = isNaN(texto) ? { atributoBase: [texto] } : { valorFixo: Number(texto) };
            }
        }

        delete session.periciaSendoAlterada;
        session.etapaAtual = 'menu_principal';
        return message.channel.send({ content: `✅ Perícia **${nomePericia}** atualizada com sucesso!` }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 4000);
            exibirMenuOpcoesEdicao(message, session);
        });
    }

    if (session.etapaAtual === 'aguardando_pv') {
        if (!session.dadosFicha.combate) session.dadosFicha.combate = {};
        const partes = texto.split('/');
        const atual = parseInt(partes[0]) || 0;
        const maximo = partes[1] ? parseInt(partes[1]) : atual;

        session.dadosFicha.combate.pv = { atual, maximo };
        session.etapaAtual = 'menu_principal';
        return message.channel.send({ content: `✅ Pontos de Vida (PV) atualizados para **${atual} / ${maximo}**!` }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 4000);
            exibirMenuOpcoesEdicao(message, session);
        });
    }

    if (session.etapaAtual === 'aguardando_pm') {
        if (!session.dadosFicha.combate) session.dadosFicha.combate = {};
        const partes = texto.split('/');
        const atual = parseInt(partes[0]) || 0;
        const maximo = partes[1] ? parseInt(partes[1]) : atual;

        session.dadosFicha.combate.pm = { atual, maximo };
        session.etapaAtual = 'menu_principal';
        return message.channel.send({ content: `✅ Pontos de Mana (PM) atualizados para **${atual} / ${maximo}**!` }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 4000);
            exibirMenuOpcoesEdicao(message, session);
        });
    }

    if (session.etapaAtual === 'aguardando_ca') {
        if (!session.dadosFicha.combate) session.dadosFicha.combate = {};
        session.dadosFicha.combate.ca = { metodo: 'valor_fixo', valorFixo: parseInt(texto) || texto };
        session.etapaAtual = 'menu_principal';
        return message.channel.send({ content: `✅ Classe de Armadura (CA) atualizada para \`${texto}\`` }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 4000);
            exibirMenuOpcoesEdicao(message, session);
        });
    }

    if (session.etapaAtual === 'aguardando_editar_arma' || session.etapaAtual === 'aguardando_editar_armadura') {
        const tipoEquip = session.etapaAtual.includes('arma') ? 'arma' : 'armadura';
        if (!session.dadosFicha.inventarioEquipamentos) session.dadosFicha.inventarioEquipamentos = {};

        const partes = texto.split('|').map(p => p.trim());
        const nome = partes[0] || 'Item';
        const valorExtra = partes[1] || (tipoEquip === 'arma' ? '1d6' : '+0');
        const desc = partes[2] || '';

        if (tipoEquip === 'arma') {
            session.dadosFicha.inventarioEquipamentos.arma = { nome, dadoDano: valorExtra, bonusDano: 0, descricao: desc };
        } else {
            session.dadosFicha.inventarioEquipamentos.armadura = { nome, bonusCa: valorExtra, ehPesada: false, descricao: desc };
        }

        session.etapaAtual = 'menu_principal';
        return message.channel.send({ content: `✅ ${tipoEquip === 'arma' ? 'Arma' : 'Armadura'} atualizada com sucesso!` }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 4000);
            exibirMenuOpcoesEdicao(message, session);
        });
    }

    return false;
}

module.exports = {
    iniciarEdicao,
    tratarInteracao,
    processarTextoEdicao,
    sessoesEdicao
};