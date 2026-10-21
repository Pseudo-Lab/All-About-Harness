/**
 * Project planner business logic
 */

/**
 * Validate that a string is non-blank
 */
function validateNonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate that a string is a valid positive safe integer ID
 */
function validateId(value) {
  // Reject strings with exponent notation, decimals, or non-numeric characters
  // Only accept strings that match positive integers exactly
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return false;
  }
  const num = Number(value);
  return Number.isSafeInteger(num) && num > 0;
}

/**
 * Parse and validate an ID from string
 */
function parseId(value) {
  if (!validateId(value)) {
    throw new Error(`Invalid ID: ${value}`);
  }
  return Number(value);
}

/**
 * Add a new project
 */
export function projectAdd(store, name) {
  if (!validateNonBlank(name)) {
    throw new Error('Project name must be non-blank');
  }

  const data = store.read();
  const project = {
    id: data.nextProjectId,
    name: name
  };
  
  data.projects.push(project);
  data.nextProjectId += 1;
  store.write(data);
  
  return project;
}

/**
 * List all projects
 */
export function projectList(store) {
  const data = store.read();
  return data.projects;
}

/**
 * Add a new task to a project
 */
export function taskAdd(store, projectIdStr, title) {
  const projectId = parseId(projectIdStr);
  
  if (!validateNonBlank(title)) {
    throw new Error('Task title must be non-blank');
  }

  const data = store.read();
  
  // Verify project exists
  const projectExists = data.projects.some(p => p.id === projectId);
  if (!projectExists) {
    throw new Error(`Project ${projectId} not found`);
  }

  const task = {
    id: data.nextTaskId,
    projectId: projectId,
    title: title,
    status: 'open',
    dependsOn: []
  };
  
  data.tasks.push(task);
  data.nextTaskId += 1;
  store.write(data);
  
  return task;
}

/**
 * List tasks for a project
 */
export function taskList(store, projectIdStr) {
  const projectId = parseId(projectIdStr);
  
  const data = store.read();
  
  // Verify project exists
  const projectExists = data.projects.some(p => p.id === projectId);
  if (!projectExists) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  // Return tasks for this project in creation order
  return data.tasks.filter(t => t.projectId === projectId);
}

/**
 * Detect cycles in dependency graph using DFS
 */
function hasCycle(tasks, taskId, onId) {
  // Build adjacency list of current dependencies
  const graph = new Map();
  for (const task of tasks) {
    graph.set(task.id, [...task.dependsOn]);
  }
  
  // Add the proposed new dependency
  if (!graph.has(taskId)) {
    graph.set(taskId, []);
  }
  graph.get(taskId).push(onId);
  
  // DFS to detect cycle starting from onId
  // If we can reach taskId from onId, there's a cycle
  const visited = new Set();
  const recStack = new Set();
  
  function dfs(nodeId) {
    if (recStack.has(nodeId)) {
      return true; // Cycle detected
    }
    if (visited.has(nodeId)) {
      return false;
    }
    
    visited.add(nodeId);
    recStack.add(nodeId);
    
    const neighbors = graph.get(nodeId) || [];
    for (const neighborId of neighbors) {
      if (dfs(neighborId)) {
        return true;
      }
    }
    
    recStack.delete(nodeId);
    return false;
  }
  
  return dfs(onId);
}

/**
 * Add a dependency between tasks
 */
export function taskDepend(store, taskIdStr, onIdStr) {
  const taskId = parseId(taskIdStr);
  const onId = parseId(onIdStr);
  
  const data = store.read();
  
  // Find the task
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  // Find the dependency task
  const onTask = data.tasks.find(t => t.id === onId);
  if (!onTask) {
    throw new Error(`Task ${onId} not found`);
  }
  
  // Reject self-links
  if (taskId === onId) {
    throw new Error('Task cannot depend on itself');
  }
  
  // Reject cross-project dependencies
  if (task.projectId !== onTask.projectId) {
    throw new Error('Cannot create cross-project dependency');
  }
  
  // Reject duplicate dependencies
  if (task.dependsOn.includes(onId)) {
    throw new Error('Dependency already exists');
  }
  
  // Reject adding dependencies to done tasks
  if (task.status === 'done') {
    throw new Error('Cannot add dependency to completed task');
  }
  
  // Check for cycles
  if (hasCycle(data.tasks, taskId, onId)) {
    throw new Error('Dependency would create a cycle');
  }
  
  // Add the dependency
  task.dependsOn.push(onId);
  store.write(data);
  
  return task;
}

/**
 * List ready tasks for a project
 */
export function taskReady(store, projectIdStr) {
  const projectId = parseId(projectIdStr);
  
  const data = store.read();
  
  // Verify project exists
  const projectExists = data.projects.some(p => p.id === projectId);
  if (!projectExists) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  // Get all tasks for this project
  const projectTasks = data.tasks.filter(t => t.projectId === projectId);
  
  // Build a set of done task IDs
  const doneTasks = new Set(projectTasks.filter(t => t.status === 'done').map(t => t.id));
  
  // Filter to open tasks where all dependencies are done
  const readyTasks = projectTasks.filter(task => {
    if (task.status !== 'open') {
      return false;
    }
    // Check if all dependencies are done
    return task.dependsOn.every(depId => doneTasks.has(depId));
  });
  
  // Return in creation order (they're already in that order from filter)
  return readyTasks;
}

/**
 * Complete a task
 */
export function taskComplete(store, taskIdStr) {
  const taskId = parseId(taskIdStr);
  
  const data = store.read();
  
  // Find the task
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  // If already done, return it idempotently without changing storage
  if (task.status === 'done') {
    return task;
  }
  
  // Check if task is ready (all dependencies are done)
  const doneTasks = new Set(data.tasks.filter(t => t.status === 'done').map(t => t.id));
  const isReady = task.dependsOn.every(depId => doneTasks.has(depId));
  
  if (!isReady) {
    throw new Error('Task is not ready to complete');
  }
  
  // Mark task as done
  task.status = 'done';
  store.write(data);
  
  return task;
}

/**
 * Generate a project report
 */
export function projectReport(store, projectIdStr) {
  const projectId = parseId(projectIdStr);
  
  const data = store.read();
  
  // Verify project exists
  const projectExists = data.projects.some(p => p.id === projectId);
  if (!projectExists) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  // Get all tasks for this project
  const projectTasks = data.tasks.filter(t => t.projectId === projectId);
  
  // Count totals
  const total = projectTasks.length;
  const done = projectTasks.filter(t => t.status === 'done').length;
  const open = projectTasks.filter(t => t.status === 'open').length;
  
  // Get ready tasks
  const doneTasks = new Set(projectTasks.filter(t => t.status === 'done').map(t => t.id));
  const readyTasks = projectTasks.filter(task => {
    if (task.status !== 'open') {
      return false;
    }
    return task.dependsOn.every(depId => doneTasks.has(depId));
  });
  
  const readyTaskIds = readyTasks.map(t => t.id);
  
  return {
    projectId,
    total,
    open,
    done,
    readyTaskIds
  };
}
