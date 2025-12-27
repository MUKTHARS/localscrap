export const formatToAccountTime = (utcDateString, timeZone) => {
  if (!utcDateString) return '-';
  
  const targetZone = timeZone || 'UTC';

  try {
    const date = new Date(utcDateString);

    const formatter = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: targetZone
    });

    return formatter.format(date);
  } catch (error) {
    console.error(`Error formatting date for zone ${targetZone}:`, error);
    return utcDateString;
  }
};
