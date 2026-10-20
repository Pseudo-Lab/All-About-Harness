import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function main() {
  const [command, ...args] = process.argv.slice(2);
  let id;
  if (command === 'add') {
    if (args.length !== 1 || args[0].trim() === '') {
      throw new Error('Usage: add TITLE (title must not be blank)');
    }
  } else if (command === 'complete') {
    if (args.length !== 1 || !/^[1-9]\d*$/.test(args[0])) {
      throw new Error('Usage: complete ID (positive integer required)');
    }
    id = Number(args[0]);
    if (!Number.isSafeInteger(id)) throw new Error('ID is outside the safe integer range');
  } else if (command !== 'list' || args.length !== 0) {
    throw new Error('Usage: node cli.mjs add TITLE | list | complete ID');
  }

  const file = process.env.TODO_FILE ?? resolve('todos.json');
  let todos;
  try {
    todos = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    todos = [];
  }
  if (!Array.isArray(todos) || !todos.every(item =>
    item !== null && typeof item === 'object' &&
    Number.isSafeInteger(item.id) && item.id > 0 &&
    typeof item.title === 'string' && typeof item.completed === 'boolean'
  ) || new Set(todos.map(item => item.id)).size !== todos.length) {
    throw new Error('Invalid todo storage');
  }

  let output;
  if (command === 'list') {
    output = todos;
  } else if (command === 'add') {
    const nextId = todos.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    if (!Number.isSafeInteger(nextId)) throw new Error('No safe integer IDs remain');
    output = { id: nextId, title: args[0], completed: false };
    todos.push(output);
    writeFileSync(file, `${JSON.stringify(todos, null, 2)}\n`);
  } else {
    output = todos.find(item => item.id === id);
    if (!output) throw new Error(`Todo ${id} does not exist`);
    if (!output.completed) {
      output.completed = true;
      writeFileSync(file, `${JSON.stringify(todos, null, 2)}\n`);
    }
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
