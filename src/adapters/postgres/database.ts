import { Pool, type QueryResultRow } from "pg";

export interface DatabaseConfig {
  connectionString: string;
  maxConnections: number;
}

export interface QueryResult<Row extends QueryResultRow = QueryResultRow> {
  rows: Row[];
}

export interface SqlExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<Row>>;
}

export interface TransactionClient extends SqlExecutor {
  release(): void;
}

export interface DatabasePool extends SqlExecutor {
  connect(): Promise<TransactionClient>;
  end(): Promise<void>;
}

export function readDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env
): DatabaseConfig | null {
  const connectionString = env.POSTGRES_URL?.trim();
  if (!connectionString) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("POSTGRES_URL must be a valid PostgreSQL connection URL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("POSTGRES_URL must use the postgres or postgresql protocol.");
  }

  const maxConnections = Number(env.POSTGRES_POOL_MAX ?? 10);
  if (!Number.isInteger(maxConnections) || maxConnections < 1) {
    throw new Error("POSTGRES_POOL_MAX must be a positive integer.");
  }

  return { connectionString, maxConnections };
}

export class PostgresDatabase implements SqlExecutor {
  constructor(private readonly pool: DatabasePool) {}

  query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<Row>> {
    return this.pool.query<Row>(sql, params);
  }

  async transaction<T>(work: (client: SqlExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "Transaction failed and rollback could not be completed."
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}

export function createPostgresDatabase(
  config: DatabaseConfig | null = readDatabaseConfig()
): PostgresDatabase | null {
  if (!config) {
    return null;
  }

  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections
  });
  return new PostgresDatabase(pool);
}
