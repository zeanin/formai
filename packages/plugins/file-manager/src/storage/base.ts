/**
 * Base interface for storage engines.
 * Implementations handle the actual reading/writing of file content.
 */
export interface StorageEngine {
  /** Unique name for this storage engine */
  name: string;

  /** Write a file to storage. Returns the storage path. */
  write(filename: string, data: Buffer): Promise<string>;

  /** Read a file from storage. Returns the file content. */
  read(path: string): Promise<Buffer>;

  /** Delete a file from storage. */
  delete(path: string): Promise<void>;

  /** Get a public URL for the file (if applicable). */
  getUrl(path: string): string;

  /** Check if a file exists */
  exists(path: string): Promise<boolean>;
}
