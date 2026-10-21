/**
 * Project and task domain rules including dependency validation,
 * readiness computation, and completion logic.
 */

/**
 * Initialize or load store data structure.
 */
export function initData(existing) {
  if (existing) {
    return existing;
  }
  return {
    projects: [],
    tasks: [],
    nextProjectId: 1,
    nextTaskId: 1,
  };
}

/**
 * Validate that a string is non-blank.
 */
export function validateNonBlank(str) {
  return typeof str === 'string' && str.trim().length > 0;
}

/**
 * Validate that a string represents a positive safe integer.
 */
export function validateId(str) {
  if (typeof str !== 'string') return false;
  // Must be in canonical integer format (digits only, no leading zeros except "0" itself)
  if (!/^[1-9][0-9]*$/.test(str)) return false;
  const num = Number(str);
  return Number.isSafeInteger(num) && num > 0;
}

/**
 * Parse and validate an ID argument.
 */
export function parseId(str) {
  if (!validateId(str)) {
    throw new Error(`Invalid ID: ${str}`);
  }
  return Number(str);
}

/**
 * Add a new project.
 */
export function addProject(data, name) {
  if (!validateNonBlank(name)) {
    throw new Error('Project name must be non-blank');
  }
  
  const project = {
    id: data.nextProjectId++,
    name: name,
  };
  
  data.projects.push(project);
  return project;
}

/**
 * List all projects in creation order.
 */
export function listProjects(data) {
  return data.projects.map(p => ({ id: p.id, name: p.name }));
}

/**
 * Find a project by ID.
 */
export function findProject(data, projectId) {
  return data.projects.find(p => p.id === projectId);
}

/**
 * Add a new task to a project.
 */
export function addTask(data, projectId, title) {
  const project = findProject(data, projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  if (!validateNonBlank(title)) {
    throw new Error('Task title must be non-blank');
  }
  
  const task = {
    id: data.nextTaskId++,
    projectId: projectId,
    title: title,
    status: 'open',
    dependsOn: [],
  };
  
  data.tasks.push(task);
  return { ...task };
}

/**
 * List all tasks for a project in creation order.
 */
export function listTasks(data, projectId) {
  const project = findProject(data, projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  return data.tasks
    .filter(t => t.projectId === projectId)
    .map(t => ({ ...t }));
}

/**
 * Find a task by ID.
 */
export function findTask(data, taskId) {
  return data.tasks.find(t => t.id === taskId);
}

/**
 * Detect if adding a dependency would create a cycle.
 */
export function hasCycle(data, fromTaskId, toTaskId) {
  const visited = new Set();
  const stack = [fromTaskId];
  
  while (stack.length > 0) {
    const current = stack.pop();
    
    if (current === toTaskId) {
      return true;
    }
    
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    
    const task = findTask(data, current);
    if (task) {
      for (const depId of task.dependsOn) {
        stack.push(depId);
      }
    }
  }
  
  return false;
}

/**
 * Add a dependency between tasks.
 */
export function addDependency(data, taskId, onId) {
  const task = findTask(data, taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  const onTask = findTask(data, onId);
  if (!onTask) {
    throw new Error(`Task ${onId} not found`);
  }
  
  // Reject self-links
  if (taskId === onId) {
    throw new Error('Task cannot depend on itself');
  }
  
  // Reject cross-project links
  if (task.projectId !== onTask.projectId) {
    throw new Error('Cannot depend on task from different project');
  }
  
  // Reject links from done tasks
  if (task.status === 'done') {
    throw new Error('Cannot add dependency to completed task');
  }
  
  // Reject duplicate links
  if (task.dependsOn.includes(onId)) {
    throw new Error('Dependency already exists');
  }
  
  // Reject cycles
  if (hasCycle(data, onId, taskId)) {
    throw new Error('Dependency would create a cycle');
  }
  
  task.dependsOn.push(onId);
  return { ...task };
}

/**
 * Get ready tasks for a project (open tasks with all dependencies done).
 */
export function getReadyTasks(data, projectId) {
  const project = findProject(data, projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  const tasks = data.tasks.filter(t => t.projectId === projectId);
  
  return tasks
    .filter(task => {
      if (task.status !== 'open') {
        return false;
      }
      
      // Check all dependencies are done
      return task.dependsOn.every(depId => {
        const depTask = findTask(data, depId);
        return depTask && depTask.status === 'done';
      });
    })
    .map(t => ({ ...t }));
}

/**
 * Complete a task (must be ready).
 */
export function completeTask(data, taskId) {
  const task = findTask(data, taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  // Idempotent: if already done, return it
  if (task.status === 'done') {
    return { ...task };
  }
  
  // Check if task is ready
  const ready = task.dependsOn.every(depId => {
    const depTask = findTask(data, depId);
    return depTask && depTask.status === 'done';
  });
  
  if (!ready) {
    throw new Error('Task is not ready (has incomplete dependencies)');
  }
  
  task.status = 'done';
  return { ...task };
}

/**
 * Get project report with counts and ready task IDs.
 */
export function getProjectReport(data, projectId) {
  const project = findProject(data, projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  
  const tasks = data.tasks.filter(t => t.projectId === projectId);
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const open = total - done;
  
  const readyTasks = tasks.filter(task => {
    if (task.status !== 'open') {
      return false;
    }
    return task.dependsOn.every(depId => {
      const depTask = findTask(data, depId);
      return depTask && depTask.status === 'done';
    });
  });
  
  const readyTaskIds = readyTasks.map(t => t.id);
  
  return {
    projectId,
    total,
    open,
    done,
    readyTaskIds,
  };
}
