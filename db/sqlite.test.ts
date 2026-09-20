import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DatabaseBinding } from "./database";
import { createSqliteDatabase } from "./sqlite";

const directories: string[] = [];
const databases: DatabaseBinding[] = [];

function temporaryDatabase(name = "test.db") {
  const directory = mkdtempSync(join(tmpdir(), "sit-sqlite-"));
  directories.push(directory);
  const database = createSqliteDatabase(join(directory, "nested", name));
  databases.push(database);
  return { database, directory };
}

afterEach(() => {
  while (databases.length) databases.pop()?.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

describe("SQLite database binding", () => {
  it("creates a missing directory and supports bound reads and writes", async () => {
    const { database } = temporaryDatabase();

    await database.prepare("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT UNIQUE)").run();
    await database.prepare("INSERT INTO items (name) VALUES (?)").bind("Primeiro").run();

    expect(await database.prepare("SELECT name FROM items WHERE id = ?").bind(1).first()).toEqual({ name: "Primeiro" });
    expect((await database.prepare("SELECT name FROM items ORDER BY id").all()).results).toEqual([{ name: "Primeiro" }]);
  });

  it("rolls back every statement when a batch fails", async () => {
    const { database } = temporaryDatabase();
    await database.prepare("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT UNIQUE)").run();

    await expect(database.batch([
      database.prepare("INSERT INTO items (name) VALUES (?)").bind("Duplicado"),
      database.prepare("INSERT INTO items (name) VALUES (?)").bind("Duplicado"),
    ])).rejects.toThrow();

    expect(await database.prepare("SELECT COUNT(*) AS total FROM items").first()).toEqual({ total: 0 });
  });

  it("persists rows after closing and reopening the database", async () => {
    const { database, directory } = temporaryDatabase("persistent.db");
    const databasePath = join(directory, "nested", "persistent.db");
    await database.prepare("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)").run();
    await database.prepare("INSERT INTO items (name) VALUES (?)").bind("Persistente").run();
    database.close();
    databases.splice(databases.indexOf(database), 1);

    const reopened = createSqliteDatabase(databasePath);
    databases.push(reopened);

    expect(await reopened.prepare("SELECT name FROM items").first()).toEqual({ name: "Persistente" });
  });

  it("rejects a batch containing a statement from another database", async () => {
    const first = temporaryDatabase("first.db").database;
    const second = temporaryDatabase("second.db").database;

    await expect(first.batch([second.prepare("SELECT 1")])).rejects.toThrow("outra conexão");
  });
});
