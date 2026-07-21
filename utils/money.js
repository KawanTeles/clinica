/**
 * utils/money.js
 * Utilitários de conversão e máscara financeira para BRL
 */

export const formatBRL = (value) => {
    if (!value) return 'R$ 0,00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(num);
};

export const parseBRLToFloat = (brlString) => {
    if (!brlString) return 0.00;
    let clean = brlString.replace(/[R$\s\.]/g, '').replace(',', '.');
    return parseFloat(clean) || 0.00;
};
