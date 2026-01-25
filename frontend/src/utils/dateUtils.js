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


// export const formatToAccountTime = (utcDateString, timeZone = 'UTC') => {
//   if (!utcDateString) return '-';

//   const targetZone = timeZone || 'UTC';

//   try {
//     let utcString = utcDateString;

//     // Ensure the string is treated as UTC
//     if (typeof utcDateString === 'string' && !utcDateString.endsWith('Z')) {
//       utcString += 'Z';
//     }

//     const date = new Date(utcString);

//     if (isNaN(date.getTime())) return utcDateString;

//     const formatter = new Intl.DateTimeFormat('en-GB', {
//       day: '2-digit',
//       month: 'short',
//       year: 'numeric',
//       hour: '2-digit',
//       minute: '2-digit',
//       second: '2-digit',
//       hour12: true,
//       timeZone: targetZone
//     });

//     return formatter.format(date);
//   } catch (error) {
//     console.error(`Error formatting date for zone ${targetZone}:`, error);
//     return utcDateString;
//   }
// };
