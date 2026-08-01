const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { armadurasDb, gerarIdUnico } = require('../database/dbManager');
const { validateWeight } = require('../utils/weightValidation');

module.exports = async function(interaction, activeSystem) {
    const promptEmbed = new EmbedBuilder().setTitle('🛡️ Criar Armadura (Passo 1/4)').setDescription(`Sistema ativo: **${activeSystem}**\n\nDigite o **nome da armadura** (ex: \`armadura de couro polido\`):`).setColor(0x5865F2);
    await interaction.update({ embeds: [promptEmbed], components: [] });

    const filter = m => m.author.id === interaction.user.id;
    const col = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    col.on('collect', async m1 => {
        await m1.delete().catch(() => {});
        const nome = m1.content.trim();

        // Passo 2: Aumenta CA
        const embed2 = new EmbedBuilder().setTitle('🛡️ Criar Armadura (Passo 2/4)').setDescription('A armadura aumenta a CA (Classe de Armadura)?').setColor(0x5865F2);
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ca_sim').setLabel('Sim').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ca_nao').setLabel('Não').setStyle(ButtonStyle.Secondary)
        );
        await interaction.editReply({ embeds: [embed2], components: [row2] });

        const reply = await interaction.fetchReply();
        const col2 = reply.createMessageComponentCollector({ time: 60000, max: 1 });

        col2.on('collect', async i2 => {
            let bonusCa = null;
            if (i2.customId === 'ca_sim') {
                await i2.update({ content: 'Em quanto a armadura aumenta a CA? (ex: `+2` ou `2`):', embeds: [], components: [] });
                const colCa = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                await new Promise(resolve => {
                    colCa.on('collect', async mc => {
                        await mc.delete().catch(() => {});
                        bonusCa = mc.content.trim();
                        resolve();
                    });
                });
            } else {
                await i2.deferUpdate();
            }

            // Passo 3: Penalidade de Destreza
            const embed3 = new EmbedBuilder().setTitle('🛡️ Criar Armadura (Passo 3/4)').setDescription('É uma armadura pesada que gera penalidade em jogadas de destreza?').setColor(0x5865F2);
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pen_sim').setLabel('Sim').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('pen_nao').setLabel('Não').setStyle(ButtonStyle.Secondary)
            );
            await interaction.editReply({ embeds: [embed3], components: [row3] });

            const col3 = reply.createMessageComponentCollector({ time: 60000, max: 1 });
            col3.on('collect', async i3 => {
                let penalidadeDestreza = null;
                if (i3.customId === 'pen_sim') {
                    await i3.update({ content: 'Jogadas que envolvem destreza ficam com - quanto? (ex: `2`):', embeds: [], components: [] });
                    const colPen = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                    await new Promise(resolve => {
                        colPen.on('collect', async mp => {
                            await mp.delete().catch(() => {});
                            penalidadeDestreza = `-${mp.content.trim().replace('-', '')}`;
                            resolve();
                        });
                    });
                } else {
                    await i3.deferUpdate();
                }

                // Descrição e Peso Final
                const embedDesc = new EmbedBuilder().setTitle('🛡️ Criar Armadura (Passo 3.5/4)').setDescription('Descreva como a armadura é:').setColor(0x5865F2);
                await interaction.editReply({ embeds: [embedDesc], components: [] });
                const colDesc = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

                colDesc.on('collect', async mDesc => {
                    await mDesc.delete().catch(() => {});
                    const descricao = mDesc.content.trim();

                    const embedPeso = new EmbedBuilder().setTitle('🛡️ Criar Armadura (Passo 4/4)').setDescription('Digite o peso da armadura usando **ponto (.)** para decimais (ex: `5.0` ou `0.1`, mínimo 0 ou 0.1kg):').setColor(0x5865F2);
                    await interaction.editReply({ embeds: [embedPeso] });

                    const colPeso = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                    colPeso.on('collect', async mPeso => {
                        await mPeso.delete().catch(() => {});
                        const validation = validateWeight(mPeso.content);
                        if (!validation.valid) {
                            return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌ Erro').setDescription(validation.message).setColor(0xED4245)] });
                        }

                        const uniqueId = gerarIdUnico();

                        armadurasDb.prepare(`
                            INSERT INTO armaduras (id, userId, guildId, systemName, nome, bonusCa, penalidadeDestreza, descricao, peso)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(uniqueId, interaction.user.id, interaction.guild.id, activeSystem, nome, bonusCa || 'Nenhum', penalidadeDestreza || 'Nenhuma', descricao, validation.value);

                        const success = new EmbedBuilder()
                            .setTitle('✅ Armadura Criada com Sucesso!')
                            .setDescription(`Nome: **${nome}**\nID Único: \`${uniqueId}\`\nSistema: **${activeSystem}**\nPeso: **${validation.value}kg**`)
                            .setColor(0x57F287);
                        await interaction.editReply({ embeds: [success] });
                    });
                });
            });
        });
    });
};