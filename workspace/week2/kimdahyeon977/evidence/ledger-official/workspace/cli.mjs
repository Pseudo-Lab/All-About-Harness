#!/usr/bin/env node

import { existsSync } from 'fs';
import * as store from './lib/store.mjs';
import * as ledger from './lib/ledger.mjs';

const storePath = process.env.LEDGER_FILE;

if (!storePath) {
  console.error('LEDGER_FILE environment variable not set');
  process.exit(1);
}

const args = process.argv.slice(2);

try {
  // Parse command
  if (args.length === 0) {
    throw new Error('No command provided');
  }
  
  const command = args[0];
  
  if (command === 'ledger') {
    if (args.length < 2) {
      throw new Error('No ledger subcommand provided');
    }
    
    const subcommand = args[1];
    
    if (subcommand === 'import') {
      if (args.length !== 3) {
        throw new Error('import requires exactly one CSV path argument');
      }
      
      const csvPath = args[2];
      
      if (!existsSync(csvPath)) {
        throw new Error(`CSV file not found: ${csvPath}`);
      }
      
      // Parse CSV
      const newRows = ledger.parseCSV(csvPath);
      
      // Load existing data
      const data = store.load(storePath);
      
      // Import with duplicate handling
      const result = ledger.importRows(data.rows, newRows);
      
      // Only save if we're adding new rows
      if (result.added > 0) {
        data.rows.push(...result.newRowsToAdd);
        store.save(storePath, data);
      }
      
      // Output result
      console.log(JSON.stringify({
        added: result.added,
        skipped: result.skipped,
        total: data.rows.length,
      }));
      
    } else if (subcommand === 'list') {
      if (args.length !== 2) {
        throw new Error('list takes no arguments');
      }
      
      const data = store.load(storePath);
      console.log(JSON.stringify(ledger.listRows(data.rows)));
      
    } else if (subcommand === 'summary') {
      if (args.length !== 2 && args.length !== 4) {
        throw new Error('summary takes 0 or 2 date arguments');
      }
      
      const data = store.load(storePath);
      
      let fromDate, toDate;
      if (args.length === 4) {
        fromDate = args[2];
        toDate = args[3];
      }
      
      const summary = ledger.summarize(data.rows, fromDate, toDate);
      console.log(JSON.stringify(summary));
      
    } else if (subcommand === 'delete') {
      if (args.length !== 3) {
        throw new Error('delete requires exactly one ID argument');
      }
      
      const id = args[2];
      
      // Load existing data
      const data = store.load(storePath);
      
      // Delete the row
      const deleted = ledger.deleteRow(data.rows, id);
      
      // Save changes
      store.save(storePath, data);
      
      // Output deleted row
      console.log(JSON.stringify(deleted));
      
    } else {
      throw new Error(`Unknown ledger subcommand: ${subcommand}`);
    }
    
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
  
  process.exit(0);
  
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
