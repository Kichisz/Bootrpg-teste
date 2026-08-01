function validateWeight(input) {
    if (!input) return { valid: false, message: 'O peso não pode estar vazio.' };
    
    let cleanInput = String(input)
        .toLowerCase()
        .replace('kg', '')
        .trim();

    let weight = parseFloat(cleanInput);

    if (isNaN(weight)) {
        return { valid: false, message: 'O peso informado não é um número válido. Lembre-se de usar ponto (.) para decimais (ex: 0.1).' };
    }
    
    if (weight === 0) {
        return { valid: true, value: 0 };
    }
    
    if (weight > 0 && weight < 0.1) {
        return { valid: false, message: 'O peso mínimo permitido é **0** ou **0.1kg**. Valores menores que 0.1 não são permitidos.' };
    }

    return { valid: true, value: weight };
}

module.exports = { validateWeight };