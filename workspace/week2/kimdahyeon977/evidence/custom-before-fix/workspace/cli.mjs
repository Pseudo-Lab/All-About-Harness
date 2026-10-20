#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';

const TODO_FILE = process.env.TODO_FILE;
const args = process.argv.slice(2);

function readTodos() {
  if (!existsSync(TODO_FILE)) {
    return [];
  }
  const content = readFileSync(TODO_FILE, 'utf8');
  return JSON.parse(content);
}

function writeTodos(todos) {
  writeFileSync(TODO_FILE, JSON.stringify(todos), 'utf8');
}

function getNextId(todos) {
  if (todos.length === 0) {
    return 1;
  }
  return Math.max(...todos.map(t => t.id)) + 1;
}

function isValidId(idStr) {
  // Must be a positive safe integer
  // No decimal points, no scientific notation, no leading zeros (except "0" itself)
  if (!/^\d+$/.test(idStr)) {
    return false;
  }
  const num = Number(idStr);
  return Number.isSafeInteger(num) && num > 0;
}

function exit(code, message) {
  if (message) {
    if (code === 0) {
      process.stdout.write(message + '\n');
    } else {
      process.stderr.write(message + '\n');
    }
  }
  process.exit(code);
}

function main() {
  const command = args[0];

  if (!command) {
    exit(1, 'Error: No command provided');
  }

  if (command === 'add') {
    if (args.length !== 2) {
      exit(1, 'Error: add requires exactly one title argument');
    }
    const title = args[1];
    // Reject empty or whitespace-only titles
    if (!title || /^\s*$/.test(title)) {
      exit(1, 'Error: Title cannot be empty or whitespace-only');
    }

    const todos = readTodos();
    const id = getNextId(todos);
    const newTodo = { id, title, completed: false };
    todos.push(newTodo);
    writeTodos(todos);
    exit(0, JSON.stringify(newTodo));
  } else if (command === 'list') {
    if (args.length !== 1) {
      exit(1, 'Error: list takes no arguments');
    }
    const todos = readTodos();
    exit(0, JSON.stringify(todos));
  } else if (command === 'complete') {
    if (args.length !== 2) {
      exit(1, 'Error: complete requires exactly one ID argument');
    }
    const idStr = args[1];
    if (!isValidId(idStr)) {
      exit(1, 'Error: Invalid ID');
    }
    const id = Number(idStr);
    const todos = readTodos();
    const todo = todos.find(t => t.id === id);
    if (!todo) {
      exit(1, 'Error: Todo not found');
    }
    todo.completed = true;
    writeTodos(todos);
    exit(0, JSON.stringify(todo));
  } else {
    exit(1, 'Error: Unknown command');
  }
}

main();
