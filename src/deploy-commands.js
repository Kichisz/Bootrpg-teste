const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { token, clientId, testGuildId } = require('./config');
const fichaCommand = require('./commands/fichas/fichaIndex');
const criadorCommand = require('./commands/criador/criadorIndex');
const inimigoCommand = require('./commands/criador/inimigoIndex');
const npcCommand = require('./commands/criador/npcIndex');
const tabelasCommand = require('./commands/Tabelas/tabelas');
const inventarioCommand = require('./commands/inventario/inventario'); // 👈 Importa o comando completo de inventário

const commands = [
    new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Sistema de avatares e proxy (Tuppers)')
        .addSubcommand(sub => sub.setName('criar').setDescription('Cria um novo avatar'))
        .addSubcommand(sub => sub.setName('ver').setDescription('Lista ou visualiza seus avatares'))
        .addSubcommand(sub => sub.setName('ativar').setDescription('Ativa um avatar para uso'))
        .addSubcommand(sub => sub.setName('editar').setDescription('Edita um avatar existente'))
        .addSubcommand(sub => sub.setName('deletar').setDescription('Deleta um avatar'))
        .addSubcommand(sub => sub.setName('setup').setDescription('Configura canais para o sistema de avatares')),

    new SlashCommandBuilder()
        .setName('sistemas')
        .setDescription('Sistema modular de criação de RPGs')
        .addSubcommand(sub => sub.setName('criar').setDescription('Inicia a criação de um novo sistema de RPG'))
        .addSubcommand(sub => sub.setName('ver').setDescription('Visualiza seus sistemas de RPG salvos'))
        .addSubcommand(sub => 
            sub.setName('compartilhar')
            .setDescription('Compartilha um sistema de RPG com outro usuário')
            .addUserOption(opt => opt.setName('usuario').setDescription('Usuário que receberá o sistema').setRequired(true))
        )
        .addSubcommand(sub => sub.setName('ativar').setDescription('Ativa um sistema de RPG para o servidor'))
        .addSubcommand(sub => sub.ativo ? sub : sub.setName('ativo').setDescription('Mostra o sistema de RPG atualmente ativo no servidor'))
        .addSubcommand(sub => sub.setName('deletar').setDescription('Deleta um ou mais sistemas de RPG criados por você')),

    // 👈 Modificado: Adicionado o subcomando 'configurar' ao /salvaguarda
    new SlashCommandBuilder()
        .setName('salvaguarda')
        .setDescription('Sistema de salvaguarda e subtipos')
        .addSubcommand(sub => 
            sub.setName('subtipos')
            .setDescription('Gerenciamento de subtipos do sistema ativo')
        )
        .addSubcommand(sub => 
            sub.setName('configurar')
            .setDescription('Configura as salvaguardas para o sistema e ficha ativa')
        ),

    fichaCommand.data,
    criadorCommand.data,
    inimigoCommand.data,
    npcCommand.data,
    tabelasCommand.data,
    inventarioCommand.data // 👈 Registra todas as opções e subcomandos atualizados do /inventario
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Limpando comandos antigos registrados...');
        await rest.put(Routes.applicationGuildCommands(clientId, testGuildId), { body: [] });

        console.log('Iniciando o registro dos novos comandos de barra (/) do bot...');
        await rest.put(Routes.applicationGuildCommands(clientId, testGuildId), { body: commands });
        
        console.log('Comandos antigos removidos e novos comandos registrados com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
})();