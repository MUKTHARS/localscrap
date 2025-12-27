export const formatToAccountTime = (dateString, timeZone = 'UTC') => {
  if (!dateString) return '-';

  try {
    let utcString = dateString;

    if (typeof dateString === 'string' && !dateString.endsWith('Z')) {
      utcString += 'Z';
    }

    const date = new Date(utcString);

    if (isNaN(date.getTime())) return dateString;

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: timeZone || 'UTC'
    }).format(date);

  } catch (error) {
    console.error("Date formatting error:", error);
    return dateString;
  }
};
