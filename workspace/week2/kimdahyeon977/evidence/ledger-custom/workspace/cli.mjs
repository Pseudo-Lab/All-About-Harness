#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseCSV, validateRow } from './lib/ledger.mjs';
import { loadStore, saveStore } from './lib/store.mjs';

const LEDGER_FILE = process.env.LEDGER_FILE || 'ledger.json';

function error(message) {
  console.error(message);
  process.exit(1);
}

function success(data) {
  console.log(JSON.stringify(data));
  process.exit(0);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    error('No command provided');
  }

  const command = args[0];

  try {
    if (command === 'ledger') {
      const subcommand = args[1];
      
      if (subcommand === 'import') {
        if (args.length !== 3) {
          error('import requires exactly one CSV path');
        }
        const csvPath = args[2];
        handleImport(csvPath);
      } else if (subcommand === 'list') {
        if (args.length !== 2) {
          error('list takes no arguments');
        }
        handleList();
      } else if (subcommand === 'summary') {
        if (args.length !== 2 && args.length !== 4) {
          error('summary takes zero or two arguments');
        }
        if (args.length === 4) {
          handleSummary(args[2], args[3]);
        } else {
          handleSummary();
        }
      } else if (subcommand === 'delete') {
        if (args.length !== 3) {
          error('delete requires exactly one ID');
        }
        handleDelete(args[2]);
      } else {
        error(`Unknown subcommand: ${subcommand}`);
      }
    } else {
      error(`Unknown command: ${command}`);
    }
  } catch (err) {
    error(err.message);
  }
}

function handleImport(csvPath) {
  let csvContent;
  try {
    csvContent = readFileSync(csvPath, 'utf8');
  } catch (err) {
    error(`Failed to read CSV file: ${err.message}`);
  }

  const rows = parseCSV(csvContent);
  
  // Validate all rows first
  for (const row of rows) {
    validateRow(row);
  }

  // Load existing store
  const store = loadStore(LEDGER_FILE);
  const existing = new Map(store.rows.map(r => [r.id, r]));

  // Check for duplicates and conflicts
  let added = 0;
  let skipped = 0;
  const toAdd = [];
  
  // Validate sum won't overflow
  let currentSum = store.rows.reduce((sum, r) => sum + r.amount, 0);
  
  for (const row of rows) {
    const existingRow = existing.get(row.id);
    if (existingRow) {
      // Check if identical
      if (existingRow.date === row.date && 
          existingRow.amount === row.amount && 
          existingRow.category === row.category) {
        skipped++;
      } else {
        throw new Error(`Duplicate ID with different data: ${row.id}`);
      }
    } else {
      // Check for safe integer sum
      const newSum = currentSum + row.amount;
      if (!Number.isSafeInteger(newSum)) {
        throw new Error('Sum of amounts would overflow safe integer');
      }
      currentSum = newSum;
      toAdd.push(row);
      added++;
    }
  }

  // Only modify store if we're adding rows
  if (added > 0) {
    store.rows.push(...toAdd);
    saveStore(LEDGER_FILE, store);
  }

  success({ added, skipped, total: store.rows.length });
}

function handleList() {
  const store = loadStore(LEDGER_FILE);
  success(store.rows);
}

function handleSummary(fromDate, toDate) {
  const store = loadStore(LEDGER_FILE);
  
  let filteredRows = store.rows;
  
  if (fromDate !== undefined && toDate !== undefined) {
    // Validate dates
    if (!isValidDate(fromDate)) {
      throw new Error(`Invalid FROM date: ${fromDate}`);
    }
    if (!isValidDate(toDate)) {
      throw new Error(`Invalid TO date: ${toDate}`);
    }
    if (fromDate > toDate) {
      throw new Error('FROM date must not be later than TO date');
    }
    
    filteredRows = store.rows.filter(row => 
      row.date >= fromDate && row.date <= toDate
    );
  }

  const count = filteredRows.length;
  const total = filteredRows.reduce((sum, row) => sum + row.amount, 0);
  const byCategory = {};
  
  for (const row of filteredRows) {
    byCategory[row.category] = (byCategory[row.category] || 0) + row.amount;
  }

  success({ count, total, byCategory });
}

function handleDelete(id) {
  const store = loadStore(LEDGER_FILE);
  const index = store.rows.findIndex(r => r.id === id);
  
  if (index === -1) {
    throw new Error(`ID not found: ${id}`);
  }

  const deleted = store.rows[index];
  store.rows.splice(index, 1);
  saveStore(LEDGER_FILE, store);
  
  success(deleted);
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

main();
