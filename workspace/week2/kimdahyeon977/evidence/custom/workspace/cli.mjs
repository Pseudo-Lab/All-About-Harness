#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TODO_FILE = process.env.TODO_FILE;
const args = process.argv.slice(2);
const command = args[0];

function exit(code) {
  process.exit(code);
}

function error(message) {
  console.error(message);
  exit(1);
}

function readTodos() {
  if (!existsSync(TODO_FILE)) {
    return { todos: [], nextId: 1 };
  }
  
  try {
    const content = readFileSync(TODO_FILE, 'utf8');
    const todos = JSON.parse(content);
    
    if (!Array.isArray(todos)) {
      return { todos: [], nextId: 1 };
    }
    
    const maxId = todos.reduce((max, todo) => Math.max(max, todo.id || 0), 0);
    return { todos, nextId: maxId + 1 };
  } catch (err) {
    return { todos: [], nextId: 1 };
  }
}

function writeTodos(todos) {
  writeFileSync(TODO_FILE, JSON.stringify(todos), 'utf8');
}

function isValidId(idStr) {
  // Must be a positive safe integer without any non-numeric characters
  if (!/^\d+$/.test(idStr)) {
    return false;
  }
  
  const num = Number(idStr);
  return Number.isSafeInteger(num) && num > 0;
}

switch (command) {
  case 'add': {
    if (args.length !== 2) {
      error('Invalid arguments');
    }
    
    const title = args[1];
    
    // Reject empty or whitespace-only titles
    if (!title || title.trim() === '') {
      error('Title cannot be empty or whitespace-only');
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
    exit(0);
    break;
  }
  
  case 'list': {
    if (args.length !== 1) {
      error('Invalid arguments');
    }
    
    const { todos } = readTodos();
    console.log(JSON.stringify(todos));
    exit(0);
    break;
  }
  
  case 'complete': {
    if (args.length !== 2) {
      error('Invalid arguments');
    }
    
    const idStr = args[1];
    
    if (!isValidId(idStr)) {
      error('Invalid ID');
    }
    
    const id = Number(idStr);
    const { todos } = readTodos();
    
    const todo = todos.find(t => t.id === id);
    if (!todo) {
      error('Todo not found');
    }
    
    todo.completed = true;
    writeTodos(todos);
    
    console.log(JSON.stringify(todo));
    exit(0);
    break;
  }
  
  default:
    error('Unknown command');
}
