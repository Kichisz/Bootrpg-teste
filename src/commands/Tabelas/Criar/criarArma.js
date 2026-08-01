const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { armasDb, gerarIdUnico } = require('../database/dbManager');
const { validateWeight } = require('../utils/weightValidation');

module.exports = async function(interaction, activeSystem) {
    const promptEmbed = new EmbedBuilder().setTitle('⚔️ Criar Arma (Passo 1/5)').setDescription(`Sistema ativo: **${activeSystem}**\n\nDigite o **nome da arma**:`).setColor(0x5865F2);
    await interaction.update({ embeds: [promptEmbed], components: [] });

    const filter = m => m.author.id === interaction.user.id;
    const col = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    col.on('collect', async m1 => {
        await m1.delete().catch(() => {});
        const nome = m1.content.trim();

        // Passo 2: Dado de dano único
        const embed2 = new EmbedBuilder().setTitle('⚔️ Criar Arma (Passo 2/5)').setDescription(`Arma: **${nome}**\nA arma possui dado de rolagem único para dano?`).setColor(0x5865F2);
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('dado_sim').setLabel('Sim').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('dado_nao').setLabel('Não').setStyle(ButtonStyle.Secondary)
        );
        await interaction.editReply({ embeds: [embed2], components: [row2] });

        const reply = await interaction.fetchReply();
        const col2 = reply.createMessageComponentCollector({ time: 60000, max: 1 });

        col2.on('collect', async i2 => {
            let dadoDano = null;
            if (i2.customId === 'dado_sim') {
                await i2.update({ content: 'Digite o dado de dano (ex: `1d6`):', embeds: [], components: [] });
                const colDado = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                await new Promise(resolve => {
                    colDado.on('collect', async md => {
                        await md.delete().catch(() => {});
                        dadoDano = md.content.trim();
                        resolve();
                    });
                });
            } else {
                await i2.deferUpdate();
            }

            // Passo 3: Bônus fixo
            const embed3 = new EmbedBuilder().setTitle('⚔️ Criar Arma (Passo 3/5)').setDescription('A arma dá algum bônus fixo em jogadas de dano?').setColor(0x5865F2);
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bonus_sim').setLabel('Sim').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('bonus_nao').setLabel('Não').setStyle(ButtonStyle.Secondary)
            );
            await interaction.editReply({ embeds: [embed3], components: [row3] });

            const col3 = reply.createMessageComponentCollector({ time: 60000, max: 1 });
            col3.on('collect', async i3 => {
                let bonusDano = null;
                if (i3.customId === 'bonus_sim') {
                    await i3.update({ content: 'Digite o valor fixo do bônus (ex: `+2` ou `2`):', embeds: [], components: [] });
                    const colBonus = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                    await new Promise(resolve => {
                        colBonus.on('collect', async mb => {
                            await mb.delete().catch(() => {});
                            bonusDano = mb.content.trim();
                            resolve();
                        });
                    });
                } else {
                    await i3.deferUpdate();
                }

                // Passo 4: Descrição e Estilo
                const embed4 = new EmbedBuilder().setTitle('⚔️ Criar Arma (Passo 4/5)').setDescription('Descreva como a arma é:').setColor(0x5865F2);
                await interaction.editReply({ embeds: [embed4], components: [] });
                const colDesc = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                
                colDesc.on('collect', async mDesc => {
                    await mDesc.delete().catch(() => {});
                    const descricao = mDesc.content.trim();

                    const embedEstilo = new EmbedBuilder().setTitle('⚔️ Criar Arma (Passo 4.5/5)').setDescription('Selecione o estilo da arma:').setColor(0x5865F2);
                    const rowEstilo = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId('estilo_arma').setPlaceholder('Escolha o estilo').addOptions([
                            new StringSelectMenuOptionBuilder().setLabel('Arma Melee').setValue('arma melee'),
                            new StringSelectMenuOptionBuilder().setLabel('Arma Branca').setValue('arma branca'),
                            new StringSelectMenuOptionBuilder().setLabel('Arma Ranged').setValue('arma ranged')
                        ])
                    );
                    await interaction.editReply({ embeds: [embedEstilo], components: [rowEstilo] });

                    const colEstilo = reply.createMessageComponentCollector({ time: 60000, max: 1 });
                    colEstilo.on('collect', async iEstilo => {
                        const estilo = iEstilo.values[0];

                        // Passo 5: Peso
                        const embedPeso = new EmbedBuilder().setTitle('⚔️ Criar Arma (Passo 5/5)').setDescription('Digite o peso da arma usando **ponto (.)** para decimais (ex: `1.5` ou `0.1`, mínimo 0 ou 0.1kg):').setColor(0x5865F2);
                        await iEstilo.update({ embeds: [embedPeso], components: [] });

                        const colPeso = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
                        colPeso.on('collect', async mPeso => {
                            await mPeso.delete().catch(() => {});
                            const validation = validateWeight(mPeso.content);
                            if (!validation.valid) {
                                return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌ Erro').setDescription(validation.message).setColor(0xED4245)] });
                            }

                            const uniqueId = gerarIdUnico();

                            armasDb.prepare(`
                                INSERT INTO armas (id, userId, guildId, systemName, nome, dadoDano, bonusDano, descricao, estilo, peso)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(uniqueId, interaction.user.id, interaction.guild.id, activeSystem, nome, dadoDano || 'Nenhum', bonusDano || 'Nenhum', descricao, estilo, validation.value);

                            const success = new EmbedBuilder()
                                .setTitle('✅ Arma Criada com Sucesso!')
                                .setDescription(`Nome: **${nome}**\nID Único: \`${uniqueId}\`\nSistema: **${activeSystem}**\nPeso: **${validation.value}kg**`)
                                .setColor(0x57F287);
                            await interaction.editReply({ embeds: [success] });
                        });
                    });
                });
            });
        });
    });
};