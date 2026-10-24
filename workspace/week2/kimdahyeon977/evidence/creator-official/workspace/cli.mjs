#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';

const args = process.argv.slice(2);
const command = args[0];
const TODO_FILE = process.env.TODO_FILE;

if (!TODO_FILE) {
  console.error('TODO_FILE environment variable not set');
  process.exit(1);
}

function readStore() {
  if (!existsSync(TODO_FILE)) {
    return [];
  }
  const content = readFileSync(TODO_FILE, 'utf8');
  return JSON.parse(content);
}

function writeStore(todos) {
  writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2), 'utf8');
}

function handleAdd() {
  if (args.length !== 2) {
    console.error('add requires exactly one argument');
    process.exit(1);
  }
  
  const title = args[1];
  
  // Reject empty or whitespace-only titles
  if (!title || title.trim().length === 0) {
    console.error('title cannot be empty or whitespace-only');
    process.exit(1);
  }
  
  const todos = readStore();
  const nextId = todos.length === 0 ? 1 : Math.max(...todos.map(t => t.id)) + 1;
  
  const newTodo = {
    id: nextId,
    title: title,
    completed: false
  };
  
  todos.push(newTodo);
  writeStore(todos);
  
  console.log(JSON.stringify(newTodo));
  process.exit(0);
}

function handleList() {
  if (args.length !== 1) {
    console.error('list does not accept arguments');
    process.exit(1);
  }
  
  const todos = readStore();
  console.log(JSON.stringify(todos));
  process.exit(0);
}

function handleComplete() {
  if (args.length !== 2) {
    console.error('complete requires exactly one argument');
    process.exit(1);
  }
  
  const idArg = args[1];
  
  // Validate ID is a positive safe integer
  // Reject: empty, non-numeric, floats, negative, zero, exponential notation, beyond safe integer
  const idNum = Number(idArg);
  
  // Check if it's a valid representation
  // Reject exponential notation, floats, non-integers
  if (
    !idArg || // empty string
    idArg.trim() !== idArg || // has whitespace
    !/^\d+$/.test(idArg) || // not pure digits (rejects negatives, floats, exponential, etc)
    !Number.isSafeInteger(idNum) || // not a safe integer
    idNum <= 0 // not positive
  ) {
    console.error('ID must be a positive safe integer');
    process.exit(1);
  }
  
  const todos = readStore();
  const todoIndex = todos.findIndex(t => t.id === idNum);
  
  if (todoIndex === -1) {
    console.error(`todo with ID ${idNum} not found`);
    process.exit(1);
  }
  
  // Update the completed flag (idempotent - works even if already completed)
  todos[todoIndex].completed = true;
  
  writeStore(todos);
  
  console.log(JSON.stringify(todos[todoIndex]));
  process.exit(0);
}

// Main dispatch
if (!command) {
  console.error('no command provided');
  process.exit(1);
}

switch (command) {
  case 'add':
    handleAdd();
    break;
  case 'list':
    handleList();
    break;
  case 'complete':
    handleComplete();
    break;
  default:
    console.error(`unknown command: ${command}`);
    process.exit(1);
}
