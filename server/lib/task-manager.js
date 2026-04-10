// 简单的内存任务管理器 — 用于异步生成流程
// 保存任务状态，避免客户端长时间挂连接导致 502

import { randomUUID } from "node:crypto";

const tasks = new Map();

const TASK_TTL_MS = 30 * 60 * 1000; // 30 分钟后清理已完成任务

export function createTask() {
  const id = randomUUID();
  const task = {
    id,
    status: "pending",     // pending | running | completed | failed
    progress: "初始化...",
    result: null,          // 完成时的 work 对象
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  tasks.set(id, task);
  return task;
}

export function updateTask(id, patch) {
  const task = tasks.get(id);
  if (!task) return null;
  Object.assign(task, patch, { updatedAt: Date.now() });
  return task;
}

export function getTask(id) {
  return tasks.get(id) || null;
}

export function cleanupOldTasks() {
  const cutoff = Date.now() - TASK_TTL_MS;
  for (const [id, task] of tasks) {
    if (task.updatedAt < cutoff && (task.status === "completed" || task.status === "failed")) {
      tasks.delete(id);
    }
  }
}

// 定期清理
setInterval(cleanupOldTasks, 5 * 60 * 1000).unref();
