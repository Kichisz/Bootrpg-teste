function verificarGM(interaction) {
    if (!interaction.member) return false;
    const temCargoGM = interaction.member.roles.cache.some(role => 
        role.name.toLowerCase() === 'gm' || role.name.toLowerCase() === 'mestre'
    );
    const eAdmin = interaction.member.permissions.has('Administrator');
    return temCargoGM || eAdmin;
}

module.exports = { verificarGM };