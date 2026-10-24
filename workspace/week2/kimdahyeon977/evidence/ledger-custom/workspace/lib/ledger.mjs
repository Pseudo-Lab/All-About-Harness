export function parseCSV(content) {
  const lines = content.split(/\r?\n/);
  
  if (lines.length === 0) {
    throw new Error('Empty CSV file');
  }

  // Check for header
  const header = lines[0];
  if (header !== 'id,date,amount,category') {
    throw new Error('Invalid CSV header');
  }

  const rows = [];
  
  // Remove trailing empty line if present
  let endIndex = lines.length;
  if (endIndex > 1 && lines[endIndex - 1] === '') {
    endIndex--;
  }

  for (let i = 1; i < endIndex; i++) {
    const line = lines[i];
    
    if (line === '') {
      throw new Error('Blank line in CSV');
    }

    const fields = parseCSVLine(line);
    
    if (fields.length !== 4) {
      throw new Error(`Row ${i} has ${fields.length} fields, expected 4`);
    }

    // Validate amount string format before parsing
    const amountStr = fields[2];
    if (!isCanonicalAmountString(amountStr)) {
      throw new Error(`Invalid amount format: ${amountStr}`);
    }

    rows.push({
      id: fields[0],
      date: fields[1],
      amount: parseInt(amountStr, 10),
      category: fields[3]
    });
  }

  return rows;
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check if it's an escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        // Start of quoted field (should be at field start)
        inQuotes = true;
        i++;
      } else if (char === ',') {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  // Add the last field
  fields.push(current);

  // Check for unclosed quotes
  if (inQuotes) {
    throw new Error('Unclosed quote in CSV');
  }

  return fields;
}

export function validateRow(row) {
  // Validate ID
  if (!/^[A-Z][A-Z0-9-]*$/.test(row.id)) {
    throw new Error(`Invalid ID: ${row.id}`);
  }

  // Validate date
  if (!isValidDate(row.date)) {
    throw new Error(`Invalid date: ${row.date}`);
  }

  // Validate amount
  if (!isValidAmount(row.amount)) {
    throw new Error(`Invalid amount: ${row.amount}`);
  }

  // Validate category (must contain non-whitespace)
  if (!/\S/.test(row.category)) {
    throw new Error(`Invalid category: must contain non-whitespace`);
  }
}

function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const [year, month, day] = dateStr.split('-').map(Number);

  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return day <= daysInMonth[month - 1];
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function isCanonicalAmountString(str) {
  // Canonical decimal format: optional minus, digits only
  // No leading zeros (except for "0" itself, but amounts must be nonzero)
  // No decimal point, no exponent notation
  if (!/^-?\d+$/.test(str)) {
    return false;
  }

  // Check for leading zeros
  if (str.length > 1 && str[0] === '0') {
    return false; // "01", "001", etc.
  }
  if (str.length > 2 && str.startsWith('-0')) {
    return false; // "-01", "-001", etc.
  }

  return true;
}

function isValidAmount(amount) {
  // Must be a safe integer
  if (!Number.isSafeInteger(amount)) {
    return false;
  }

  // Must be nonzero
  if (amount === 0) {
    return false;
  }

  return true;
}
