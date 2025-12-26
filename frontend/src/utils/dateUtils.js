export const formatToAccountTime = (utcDateString, accountTimezone = 'UTC') => {
  if (!utcDateString) return '—';

  try {
    const date = new Date(utcDateString);
    
    // Validate date
    if (isNaN(date.getTime())) return 'Invalid date';

    // Force the specific TimeZone, ignoring the browser's system clock
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: accountTimezone 
    }).format(date);
    
  } catch (error) {
    console.error("Date formatting error:", error);
    return utcDateString;
  }
};

export const AVAILABLE_TIMEZONES = [
  "UTC",
  "Asia/Dubai",
  "Asia/Kolkata",
  "America/New_York",
  "Europe/London",
  "Asia/Singapore",
  "Australia/Sydney"
];
