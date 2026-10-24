#!/usr/bin/env node

import { Store } from './lib/store.mjs';
import {
  initData,
  parseId,
  addProject,
  listProjects,
  addTask,
  listTasks,
  addDependency,
  getReadyTasks,
  completeTask,
  getProjectReport,
} from './lib/planner.mjs';

/**
 * Main CLI entry point.
 * Parses commands, loads/saves storage, and prints JSON results.
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
  const command = args[0];
  const subcommand = args[1];
  
  try {
    let result;
    let needsSave = false;
    
    // Load existing data for all commands
    let data = initData(store.load());
    
    if (command === 'project') {
      if (subcommand === 'add') {
        if (args.length !== 3) {
          throw new Error('project add requires exactly one argument');
        }
        result = addProject(data, args[2]);
        needsSave = true;
      } else if (subcommand === 'list') {
        if (args.length !== 2) {
          throw new Error('project list requires no arguments');
        }
        result = listProjects(data);
      } else if (subcommand === 'report') {
        if (args.length !== 3) {
          throw new Error('project report requires exactly one argument');
        }
        const projectId = parseId(args[2]);
        result = getProjectReport(data, projectId);
      } else {
        throw new Error(`Unknown project subcommand: ${subcommand}`);
      }
    } else if (command === 'task') {
      if (subcommand === 'add') {
        if (args.length !== 4) {
          throw new Error('task add requires exactly two arguments');
        }
        const projectId = parseId(args[2]);
        result = addTask(data, projectId, args[3]);
        needsSave = true;
      } else if (subcommand === 'list') {
        if (args.length !== 3) {
          throw new Error('task list requires exactly one argument');
        }
        const projectId = parseId(args[2]);
        result = listTasks(data, projectId);
      } else if (subcommand === 'depend') {
        if (args.length !== 4) {
          throw new Error('task depend requires exactly two arguments');
        }
        const taskId = parseId(args[2]);
        const onId = parseId(args[3]);
        result = addDependency(data, taskId, onId);
        needsSave = true;
      } else if (subcommand === 'ready') {
        if (args.length !== 3) {
          throw new Error('task ready requires exactly one argument');
        }
        const projectId = parseId(args[2]);
        result = getReadyTasks(data, projectId);
      } else if (subcommand === 'complete') {
        if (args.length !== 3) {
          throw new Error('task complete requires exactly one argument');
        }
        const taskId = parseId(args[2]);
        result = completeTask(data, taskId);
        needsSave = true;
      } else {
        throw new Error(`Unknown task subcommand: ${subcommand}`);
      }
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
    
    // Save if needed
    if (needsSave) {
      store.save(data);
    }
    
    // Print result as JSON
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
