#!/usr/bin/env node

import { Store } from './lib/store.mjs';
import {
  projectAdd,
  projectList,
  taskAdd,
  taskList,
  taskDepend,
  taskReady,
  taskComplete,
  projectReport
} from './lib/planner.mjs';

/**
 * Main CLI entry point
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('No command provided');
    process.exit(1);
  }

  const planFile = process.env.PLAN_FILE;
  if (!planFile) {
    console.error('PLAN_FILE environment variable not set');
    process.exit(1);
  }

  const store = new Store(planFile);
  
  try {
    const command = args[0];
    const subcommand = args[1];
    
    let result;
    
    if (command === 'project') {
      if (subcommand === 'add') {
        if (args.length !== 3) {
          throw new Error('project add requires exactly 1 argument');
        }
        result = projectAdd(store, args[2]);
      } else if (subcommand === 'list') {
        if (args.length !== 2) {
          throw new Error('project list requires no arguments');
        }
        result = projectList(store);
      } else if (subcommand === 'report') {
        if (args.length !== 3) {
          throw new Error('project report requires exactly 1 argument');
        }
        result = projectReport(store, args[2]);
      } else {
        throw new Error(`Unknown project subcommand: ${subcommand}`);
      }
    } else if (command === 'task') {
      if (subcommand === 'add') {
        if (args.length !== 4) {
          throw new Error('task add requires exactly 2 arguments');
        }
        result = taskAdd(store, args[2], args[3]);
      } else if (subcommand === 'list') {
        if (args.length !== 3) {
          throw new Error('task list requires exactly 1 argument');
        }
        result = taskList(store, args[2]);
      } else if (subcommand === 'depend') {
        if (args.length !== 4) {
          throw new Error('task depend requires exactly 2 arguments');
        }
        result = taskDepend(store, args[2], args[3]);
      } else if (subcommand === 'ready') {
        if (args.length !== 3) {
          throw new Error('task ready requires exactly 1 argument');
        }
        result = taskReady(store, args[2]);
      } else if (subcommand === 'complete') {
        if (args.length !== 3) {
          throw new Error('task complete requires exactly 1 argument');
        }
        result = taskComplete(store, args[2]);
      } else {
        throw new Error(`Unknown task subcommand: ${subcommand}`);
      }
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
    
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
