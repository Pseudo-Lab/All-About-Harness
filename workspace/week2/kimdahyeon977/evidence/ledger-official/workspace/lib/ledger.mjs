import { readFileSync } from 'fs';

/**
 * Parse CSV line handling quoted fields with commas and escaped quotes
 */
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
    throw new Error('Unclosed quote in CSV field');
  }
  
  return fields;
}

/**
 * Validate ID format: ^[A-Z][A-Z0-9-]*$
 */
function isValidId(id) {
  return /^[A-Z][A-Z0-9-]*$/.test(id);
}

/**
 * Validate date and check if it's a real calendar day
 */
function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Check basic ranges
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  
  // Days in each month (non-leap year)
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  // Check for leap year
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  
  let maxDay = daysInMonth[month - 1];
  if (month === 2 && isLeapYear) {
    maxDay = 29;
  }
  
  if (day > maxDay) {
    return false;
  }
  
  return true;
}

/**
 * Validate amount: nonzero signed safe integer as canonical decimal string
 */
function isValidAmount(amountStr) {
  // Must match canonical format: no plus, no leading zeros, no decimal point, no exponent
  if (!/^-?\d+$/.test(amountStr)) {
    return false;
  }
  
  // No leading zeros (except for "-0" which should be rejected as zero)
  if (amountStr.length > 1 && amountStr[0] === '0') {
    return false;
  }
  if (amountStr.length > 2 && amountStr[0] === '-' && amountStr[1] === '0') {
    return false;
  }
  
  const amount = Number(amountStr);
  
  // Must be nonzero
  if (amount === 0) {
    return false;
  }
  
  // Must be a safe integer
  if (!Number.isSafeInteger(amount)) {
    return false;
  }
  
  return true;
}

/**
 * Validate category: must contain non-whitespace text
 */
function isValidCategory(category) {
  return category.trim().length > 0;
}

/**
 * Parse and validate CSV file
 */
export function parseCSV(csvPath) {
  const content = readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/);
  
  // Check header
  if (lines.length === 0 || lines[0] !== 'id,date,amount,category') {
    throw new Error('Invalid CSV header');
  }
  
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip final empty line
    if (i === lines.length - 1 && line === '') {
      continue;
    }
    
    // Blank lines between records are invalid
    if (line === '') {
      throw new Error('Blank line in CSV');
    }
    
    const fields = parseCSVLine(line);
    
    if (fields.length !== 4) {
      throw new Error(`Invalid number of fields at line ${i + 1}`);
    }
    
    const [id, date, amount, category] = fields;
    
    // Validate each field
    if (!isValidId(id)) {
      throw new Error(`Invalid ID: ${id}`);
    }
    
    if (!isValidDate(date)) {
      throw new Error(`Invalid date: ${date}`);
    }
    
    if (!isValidAmount(amount)) {
      throw new Error(`Invalid amount: ${amount}`);
    }
    
    if (!isValidCategory(category)) {
      throw new Error(`Invalid category: ${category}`);
    }
    
    rows.push({
      id,
      date,
      amount: Number(amount),
      category,
    });
  }
  
  return rows;
}

/**
 * Import rows into ledger with duplicate handling
 */
export function importRows(existingRows, newRows) {
  // Build a map of existing rows by ID
  const existingMap = new Map();
  for (const row of existingRows) {
    existingMap.set(row.id, row);
  }
  
  // Validate all new rows and detect conflicts before modifying anything
  const toAdd = [];
  let skipped = 0;
  
  // Track cumulative sum to ensure it stays within safe integer range
  let currentSum = existingRows.reduce((sum, row) => sum + row.amount, 0);
  
  for (const newRow of newRows) {
    const existing = existingMap.get(newRow.id);
    
    if (existing) {
      // Check if it's an identical duplicate
      if (
        existing.date === newRow.date &&
        existing.amount === newRow.amount &&
        existing.category === newRow.category
      ) {
        skipped++;
      } else {
        // Conflict: same ID but different data
        throw new Error(`Duplicate ID with different data: ${newRow.id}`);
      }
    } else {
      // New row - check if sum remains safe
      const newSum = currentSum + newRow.amount;
      if (!Number.isSafeInteger(newSum)) {
        throw new Error('Sum of amounts exceeds safe integer range');
      }
      currentSum = newSum;
      toAdd.push(newRow);
      existingMap.set(newRow.id, newRow); // Add to map for detecting conflicts within the import
    }
  }
  
  return {
    added: toAdd.length,
    skipped,
    newRowsToAdd: toAdd,
  };
}

/**
 * List all rows
 */
export function listRows(rows) {
  return rows;
}

/**
 * Calculate summary for all rows or date range
 */
export function summarize(rows, fromDate, toDate) {
  // Validate date range if provided
  if (fromDate !== undefined && toDate !== undefined) {
    if (!isValidDate(fromDate) || !isValidDate(toDate)) {
      throw new Error('Invalid date in range');
    }
    if (fromDate > toDate) {
      throw new Error('FROM date must be no later than TO date');
    }
  }
  
  // Filter rows if date range is specified
  let filteredRows = rows;
  if (fromDate !== undefined && toDate !== undefined) {
    filteredRows = rows.filter(row => row.date >= fromDate && row.date <= toDate);
  }
  
  // Calculate summary
  const byCategory = {};
  let total = 0;
  
  for (const row of filteredRows) {
    total += row.amount;
    byCategory[row.category] = (byCategory[row.category] || 0) + row.amount;
  }
  
  return {
    count: filteredRows.length,
    total,
    byCategory,
  };
}

/**
 * Delete a row by ID
 */
export function deleteRow(rows, id) {
  const index = rows.findIndex(row => row.id === id);
  
  if (index === -1) {
    throw new Error(`ID not found: ${id}`);
  }
  
  const deleted = rows[index];
  rows.splice(index, 1);
  
  return deleted;
}
