export const getFormattedCurrency = (currencyCode) => {
  if (!currencyCode || currencyCode === 'NA') return '';

  const currencyMap = {
    'USD': '$',    // US Dollar
    'EUR': '€',    // Euro
    'GBP': '£',    // British Pound
    'INR': '₹',    // Indian Rupee
    'JPY': '¥',    // Japanese Yen
    'CNY': '¥',    // Chinese Yuan
    'RUB': '₽',    // Russian Ruble
    'KRW': '₩',    // South Korean Won
    'TRY': '₺',    // Turkish Lira
    'BRL': 'R$',   // Brazilian Real

    // --- Dollar Variants (Explicit for Clarity) ---
    'AUD': 'A$',   // Australian Dollar
    'CAD': 'C$',   // Canadian Dollar
    'SGD': 'S$',   // Singapore Dollar
    'MXN': 'Mex$', // Mexican Peso
    'NZD': 'NZ$',  // New Zealand Dollar
    'HKD': 'HK$',  // Hong Kong Dollar

    // --- European / Scandinavian ---
    'PLN': 'zł',   // Polish Zloty
    'SEK': 'kr',   // Swedish Krona
    'DKK': 'kr',   // Danish Krone
    'NOK': 'kr',   // Norwegian Krone
    'CHF': 'Fr',   // Swiss Franc
    'UAH': '₴',    // Ukrainian Hryvnia

    // --- Middle East / Arabic ---
    'AED': 'د.إ',  // UAE Dirham
    'SAR': 'ر.س',  // Saudi Riyal
    'EGP': 'E£',   // Egyptian Pound (or ج.م)

    // --- Asian / Other ---
    'VND': '₫',    // Vietnamese Dong
    'THB': '฿',    // Thai Baht
    'PHP': '₱',    // Philippine Peso
    'IDR': 'Rp',   // Indonesian Rupiah
    'MYR': 'RM',   // Malaysian Ringgit
    'PKR': '₨',    // Pakistani Rupee
    'NGN': '₦',    // Nigerian Naira
    'ZAR': 'R',    // South African Rand

    // --- Rare / Latin American (From your Regex) ---
    'GHS': '₵',    // Ghanaian Cedi
    'PYG': '₲',    // Paraguayan Guarani
    'CRC': '₡',    // Costa Rican Colón
    'KZT': '₸',    // Kazakhstani Tenge
    'LAK': '₭',    // Lao Kip
    'MNT': '₮',    // Mongolian Tögrög
    'GEL': '₾',    // Georgian Lari
    'AZN': '₼',    // Azerbaijani Manat
  };

  return currencyMap[currencyCode] || currencyCode;
};
