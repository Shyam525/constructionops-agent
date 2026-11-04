import { describe, expect, it, vi } from "vitest";
import {
  PostgresDatabase,
  readDatabaseConfig,
  type DatabasePool,
  type TransactionClient
} from "../src/adapters/postgres/database.js";

function createPool(client: TransactionClient): DatabasePool {
  return {
    query: vi.fn(async () => ({ rows: [] })),
    connect: vi.fn(async () => client),
    end: vi.fn(async () => undefined)
  };
}

describe("PostgresDatabase", () => {
  it("validates optional PostgreSQL configuration", () => {
    expect(readDatabaseConfig({})).toBeNull();
    expect(readDatabaseConfig({ POSTGRES_URL: "postgres://user:pass@localhost/db" })).toEqual({
      connectionString: "postgres://user:pass@localhost/db",
      maxConnections: 10
    });
    expect(() => readDatabaseConfig({ POSTGRES_URL: "http://localhost/db" })).toThrow(
      "POSTGRES_URL must use the postgres or postgresql protocol."
    );
    expect(() =>
      readDatabaseConfig({
        POSTGRES_URL: "postgres://localhost/db",
        POSTGRES_POOL_MAX: "0"
      })
    ).toThrow("POSTGRES_POOL_MAX must be a positive integer.");
  });

  it("commits successful work and releases the client", async () => {
    const query = vi.fn(async (_sql: string) => ({ rows: [] }));
    const release = vi.fn();
    const pool = createPool({ query, release });
    const database = new PostgresDatabase(pool);

    await expect(database.transaction(async (client) => {
      await client.query("UPDATE projects SET name = $1", ["Updated"]);
      return "done";
    })).resolves.toBe("done");

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "UPDATE projects SET name = $1",
      "COMMIT"
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back failed work and releases the client", async () => {
    const failure = new Error("write failed");
    const query = vi.fn(async (sql: string) => {
      if (sql === "UPDATE projects SET name = $1") {
        throw failure;
      }
      return { rows: [] };
    });
    const release = vi.fn();
    const database = new PostgresDatabase(createPool({ query, release }));

    await expect(database.transaction(async (client) => {
      await client.query("UPDATE projects SET name = $1", ["Updated"]);
    })).rejects.toBe(failure);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "UPDATE projects SET name = $1",
      "ROLLBACK"
    ]);
    expect(release).toHaveBeenCalledOnce();
  });
});
