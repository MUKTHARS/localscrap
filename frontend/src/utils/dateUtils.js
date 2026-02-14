export const formatToAccountTime = (dateString, timezone, format = 'full') => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    
    if (format === 'short') {
      return date.toLocaleDateString('en-US', {
        timeZone: timezone || 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    if (format === 'MMM DD, YYYY') {
      return date.toLocaleDateString('en-US', {
        timeZone: timezone || 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    // Default full format
    return date.toLocaleString('en-US', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};