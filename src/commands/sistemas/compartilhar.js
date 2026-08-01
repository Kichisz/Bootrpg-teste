const { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database');

// Armazena temporariamente os dados do fluxo: senderId -> { targetId, targetName, systemId, systemName }
const pendingShares = new Map();
// Armazena o cooldown: `${senderId}_${targetId}` -> timestamp limite
const shareCooldowns = new Map();

async function iniciarCompartilhamento(interaction) {
    await interaction.deferReply({ flags: [64] });

    const targetUser = interaction.options.getUser('usuario');
    const sender = interaction.user;

    if (targetUser.id === sender.id) {
        return interaction.editReply({ content: '❌ Você não pode compartilhar um sistema com você mesmo.' });
    }

    if (targetUser.bot) {
        return interaction.editReply({ content: '❌ Você não pode compartilhar um sistema com um bot.' });
    }

    // Verificar cooldown de 5 minutos para esta pessoa específica
    const cooldownKey = `${sender.id}_${targetUser.id}`;
    const cooldownTime = shareCooldowns.get(cooldownKey);
    if (cooldownTime && Date.now() < cooldownTime) {
        const minutosRestantes = Math.ceil((cooldownTime - Date.now()) / 60000);
        return interaction.editReply({ content: `⏳ Você está em cooldown para enviar pedidos de compartilhamento para ${targetUser.username}. Tente novamente em ${minutosRestantes} minuto(s).` });
    }

    // Buscar sistemas do remetente
    const sistemas = db.prepare('SELECT * FROM rpg_systems WHERE userId = ?').all(sender.id);
    if (!sistemas || sistemas.length === 0) {
        return interaction.editReply({ content: '⚠️ Você não possui nenhum sistema de RPG cadastrado para compartilhar.' });
    }

    const options = sistemas.slice(0, 25).map(sys => {
        const nome = sys.nome || sys.nomeSistema || 'Sistema RPG';
        return {
            label: nome.substring(0, 100),
            value: String(sys.id)
        };
    });

    pendingShares.set(sender.id, { targetId: targetUser.id, targetName: targetUser.username });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`compartilhar_select_${sender.id}`)
        .setPlaceholder('Selecione o sistema que deseja compartilhar...')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🔗 Compartilhar Sistema de RPG')
        .setDescription(`Qual sistema deseja compartilhar com **${targetUser.username}**?`);

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleInteractions(interaction) {
    const customId = interaction.customId;
    if (!customId) return false;

    // 1. Seleção do sistema no dropdown
    if (interaction.isStringSelectMenu() && customId.startsWith('compartilhar_select_')) {
        const senderId = customId.replace('compartilhar_select_', '');
        if (interaction.user.id !== senderId) {
            return interaction.reply({ content: '❌ Esta interação não é sua.', flags: [64] });
        }

        await interaction.deferUpdate();
        const systemId = interaction.values[0];
        const sys = db.prepare('SELECT * FROM rpg_systems WHERE id = ?').get(systemId);
        
        if (!sys) {
            return interaction.editReply({ content: '❌ Sistema não encontrado.', embeds: [], components: [] });
        }

        const systemName = sys.nome || sys.nomeSistema || 'Sistema RPG';
        const shareData = pendingShares.get(senderId) || {};
        shareData.systemId = systemId;
        shareData.systemName = systemName;
        pendingShares.set(senderId, shareData);

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ Confirmação de Compartilhamento')
            .setDescription(`Deseja mesmo compartilhar o sistema **${systemName}** com **${shareData.targetName}**?`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`compartilhar_conf_sim_${senderId}`).setLabel('Sim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`compartilhar_conf_nao_${senderId}`).setLabel('Não').setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
        return true;
    }

    // 2. Confirmação do remetente (Sim / Não)
    if (interaction.isButton() && (customId.startsWith('compartilhar_conf_sim_') || customId.startsWith('compartilhar_conf_nao_'))) {
        const isSim = customId.startsWith('compartilhar_conf_sim_');
        const senderId = customId.replace(isSim ? 'compartilhar_conf_sim_' : 'compartilhar_conf_nao_', '');

        if (interaction.user.id !== senderId) {
            return interaction.reply({ content: '❌ Esta interação não é sua.', flags: [64] });
        }

        await interaction.deferUpdate();
        const shareData = pendingShares.get(senderId);

        if (!shareData) {
            return interaction.editReply({ content: '⚠️ Sessão expirada.', embeds: [], components: [] });
        }

        if (!isSim) {
            pendingShares.delete(senderId);
            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Cancelado')
                .setDescription('O compartilhamento foi cancelado.');
            await interaction.editReply({ embeds: [embed], components: [] });
            return true;
        }

        // Se clicou Sim, remove dos pendentes locais e envia a mensagem pública marcando o destinatário
        pendingShares.delete(senderId);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📨 Pedido Enviado')
            .setDescription(`Solicitação enviada para <@${shareData.targetId}>.`);
        await interaction.editReply({ embeds: [embed], components: [] });

        const targetEmbed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('📥 Convite de Sistema de RPG')
            .setDescription(`<@${senderId}> quer compartilhar o sistema **${shareData.systemName}** com você, deseja aceitar?`);

        const targetRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`compartilhar_aceitar_${senderId}_${shareData.targetId}_${shareData.systemId}`).setLabel('Sim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`compartilhar_recusar_${senderId}_${shareData.targetId}_${shareData.systemId}`).setLabel('Não').setStyle(ButtonStyle.Danger)
        );

        await interaction.channel.send({
            content: `<@${shareData.targetId}>`,
            embeds: [targetEmbed],
            components: [targetRow]
        });

        return true;
    }

    // 3. Resposta do destinatário (Sim / Não ao receber)
    if (interaction.isButton() && (customId.startsWith('compartilhar_aceitar_') || customId.startsWith('compartilhar_recusar_'))) {
        const isAceitar = customId.startsWith('compartilhar_aceitar_');
        const parts = customId.replace(isAceitar ? 'compartilhar_aceitar_' : 'compartilhar_recusar_', '').split('_');
        const senderId = parts[0];
        const targetId = parts[1];
        const systemId = parts[2];

        if (interaction.user.id !== targetId) {
            return interaction.reply({ content: '❌ Este botão não é para você.', flags: [64] });
        }

        await interaction.deferUpdate();

        if (!isAceitar) {
            // Se o destinatário clicou Não -> Aplicar cooldown de 5 minutos para o remetente com este destinatário
            const cooldownKey = `${senderId}_${targetId}`;
            shareCooldowns.set(cooldownKey, Date.now() + 5 * 60 * 1000);

            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Convite Recusado')
                .setDescription('Você recusou o compartilhamento deste sistema.');
            await interaction.editReply({ embeds: [embed], components: [] });
            return true;
        }

        // Se o destinatário clicou Sim -> Criar cópia exata para ele no banco de dados
        const sys = db.prepare('SELECT * FROM rpg_systems WHERE id = ?').get(systemId);
        if (!sys) {
            return interaction.editReply({ content: '⚠️ O sistema original não foi encontrado ou foi excluído.', embeds: [], components: [] });
        }

        try {
            const keys = Object.keys(sys).filter(k => k !== 'id');
            const values = keys.map(k => k === 'userId' ? targetId : sys[k]);
            const placeholders = keys.map(() => '?').join(', ');
            const columns = keys.join(', ');

            db.prepare(`INSERT INTO rpg_systems (${columns}) VALUES (${placeholders})`).run(...values);

            const systemName = sys.nome || sys.nomeSistema || 'Sistema RPG';
            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Sistema Aceito com Sucesso!')
                .setDescription(`Você aceitou o sistema **${systemName}**. Uma cópia exata foi criada na sua conta!`);
            await interaction.editReply({ embeds: [embed], components: [] });
        } catch (err) {
            console.error('Erro ao copiar sistema:', err);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao criar a cópia do sistema.', embeds: [], components: [] });
        }

        return true;
    }

    return false;
}

module.exports = {
    iniciarCompartilhamento,
    handleInteractions
};