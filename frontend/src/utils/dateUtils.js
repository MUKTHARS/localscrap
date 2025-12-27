export const AVAILABLE_TIMEZONES = [
  'UTC',
  'Asia/Dubai',
  'Asia/Kolkata',
  'America/New_York',
  'Europe/London',
  'Asia/Singapore',
  'Australia/Sydney',
];

export const formatToAccountTime = (dateString, timeZone = 'UTC') => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);

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
