#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TODO_FILE = process.env.TODO_FILE;

if (!TODO_FILE) {
  console.error('TODO_FILE environment variable is required');
  process.exit(1);
}

function readStore() {
  if (!existsSync(TODO_FILE)) {
    return { todos: [], nextId: 1 };
  }
  const content = readFileSync(TODO_FILE, 'utf8');
  const todos = JSON.parse(content);
  const maxId = todos.length > 0 ? Math.max(...todos.map(t => t.id)) : 0;
  return { todos, nextId: maxId + 1 };
}

function writeStore(todos) {
  writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2), 'utf8');
}

function add(title) {
  // Validate title
  if (typeof title !== 'string' || title.trim().length === 0) {
    console.error('Title cannot be empty or whitespace-only');
    process.exit(1);
  }

  const { todos, nextId } = readStore();
  const newTodo = {
    id: nextId,
    title: title,
    completed: false
  };

  todos.push(newTodo);
  writeStore(todos);
  console.log(JSON.stringify(newTodo));
}

function list() {
  const { todos } = readStore();
  console.log(JSON.stringify(todos));
}

function complete(idStr) {
  // Validate ID format
  const id = Number(idStr);
  if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== idStr) {
    console.error('ID must be a positive safe integer');
    process.exit(1);
  }

  const { todos } = readStore();
  
  // Find the todo by ID
  const todo = todos.find(t => t.id === id);
  if (!todo) {
    console.error(`Todo with ID ${id} not found`);
    process.exit(1);
  }

  // Mark as completed (repeatable - no error if already completed)
  todo.completed = true;
  
  writeStore(todos);
  console.log(JSON.stringify(todo));
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('No command provided');
  process.exit(1);
}

const command = args[0];

switch (command) {
  case 'add':
    if (args.length !== 2) {
      console.error('add requires exactly one argument (title)');
      process.exit(1);
    }
    add(args[1]);
    break;

  case 'list':
    if (args.length !== 1) {
      console.error('list does not accept any arguments');
      process.exit(1);
    }
    list();
    break;

  case 'complete':
    if (args.length !== 2) {
      console.error('complete requires exactly one argument (id)');
      process.exit(1);
    }
    complete(args[1]);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
