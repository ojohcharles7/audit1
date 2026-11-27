"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "crunchies-audit-offline";
const VERSION = 1;

type DraftRecord = {
  auditId: string;
  savedAt: string;
  responses: Record<string, unknown>;
};

type QueueRecord = {
  id?: number;
  auditId: string;
  questionId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("drafts")) database.createObjectStore("drafts", { keyPath: "auditId" });
        if (!database.objectStoreNames.contains("queue")) database.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

export async function saveLocalDraft(auditId: string, responses: Record<string, unknown>) {
  const database = await db();
  await database.put("drafts", { auditId, savedAt: new Date().toISOString(), responses } satisfies DraftRecord);
}

export async function loadLocalDraft(auditId: string): Promise<DraftRecord | null> {
  const database = await db();
  return (await database.get("drafts", auditId)) ?? null;
}

export async function clearLocalDraft(auditId: string) {
  const database = await db();
  await database.delete("drafts", auditId);
}

export async function queueSave(record: Omit<QueueRecord, "id">) {
  const database = await db();
  await database.add("queue", record);
}

export async function getQueuedSaves(): Promise<QueueRecord[]> {
  const database = await db();
  return database.getAll("queue") as Promise<QueueRecord[]>;
}

export async function deleteQueuedSave(id: number) {
  const database = await db();
  await database.delete("queue", id);
}

export async function clearQueue(auditId: string) {
  const database = await db();
  const items = (await database.getAll("queue")) as QueueRecord[];
  await Promise.all(items.filter((item) => item.auditId === auditId && item.id != null).map((item) => database.delete("queue", item.id!)));
}
