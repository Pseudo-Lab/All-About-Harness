#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';

const TODO_FILE = process.env.TODO_FILE;
const args = process.argv.slice(2);
const command = args[0];

function exit(code) {
  process.exit(code);
}

function readTodos() {
  if (!existsSync(TODO_FILE)) {
    return { todos: [], nextId: 1 };
  }
  try {
    const content = readFileSync(TODO_FILE, 'utf8');
    const data = JSON.parse(content);
    const nextId = data.length > 0 ? Math.max(...data.map(t => t.id)) + 1 : 1;
    return { todos: data, nextId };
  } catch (err) {
    process.stderr.write('Failed to read TODO file\n');
    exit(1);
  }
}

function writeTodos(todos) {
  try {
    writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2), 'utf8');
  } catch (err) {
    process.stderr.write('Failed to write TODO file\n');
    exit(1);
  }
}

function isValidId(str) {
  // Must be a positive safe integer in string form
  // Reject: empty, non-numeric, decimals, scientific notation, leading zeros (except "0" itself), negative, zero, unsafe
  if (!str || typeof str !== 'string') return false;
  if (!/^[1-9]\d*$/.test(str)) return false;
  const num = Number(str);
  return Number.isSafeInteger(num) && num > 0;
}

function cmdAdd(args) {
  if (args.length !== 1) {
    process.stderr.write('add requires exactly one argument\n');
    exit(1);
  }
  const title = args[0];
  // Reject empty or whitespace-only titles
  if (!title || /^\s*$/.test(title)) {
    process.stderr.write('Title cannot be empty or whitespace-only\n');
    exit(1);
  }
  
  const { todos, nextId } = readTodos();
  const newTodo = {
    id: nextId,
    title: title,
    completed: false
  };
  todos.push(newTodo);
  writeTodos(todos);
  console.log(JSON.stringify(newTodo));
}

function cmdList(args) {
  if (args.length !== 0) {
    process.stderr.write('list takes no arguments\n');
    exit(1);
  }
  
  const { todos } = readTodos();
  console.log(JSON.stringify(todos));
}

function cmdComplete(args) {
  if (args.length !== 1) {
    process.stderr.write('complete requires exactly one argument\n');
    exit(1);
  }
  
  const idStr = args[0];
  if (!isValidId(idStr)) {
    process.stderr.write('Invalid ID format\n');
    exit(1);
  }
  
  const id = Number(idStr);
  const { todos } = readTodos();
  const todo = todos.find(t => t.id === id);
  
  if (!todo) {
    process.stderr.write(`Todo with ID ${id} not found\n`);
    exit(1);
  }
  
  todo.completed = true;
  writeTodos(todos);
  console.log(JSON.stringify(todo));
}

// Main command dispatch
if (!command) {
  process.stderr.write('No command specified\n');
  exit(1);
}

switch (command) {
  case 'add':
    cmdAdd(args.slice(1));
    break;
  case 'list':
    cmdList(args.slice(1));
    break;
  case 'complete':
    cmdComplete(args.slice(1));
    break;
  default:
    process.stderr.write(`Unknown command: ${command}\n`);
    exit(1);
}
