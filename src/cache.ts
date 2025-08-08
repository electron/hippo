import * as fs from 'node:fs';

interface Cache {
  has(key: string): boolean;
  put(key: string): void;
}

// cache file path
export const CACHE_FILE = '.cache';

// file-based cache for string keys
export class FileCache implements Cache {
  private cache: string[];
  private cacheFile: string;

  constructor(cacheFile: string = CACHE_FILE) {
    this.cache = [];
    this.cacheFile = cacheFile;
    this.loadCache();
  }

  has(key: string): boolean {
    return this.cache.includes(key);
  }

  put(key: string): void {
    if (this.has(key)) return;
    this.cache.push(key);
    this.saveCache();
  }

  private loadCache() {
    if (!fs.existsSync(this.cacheFile)) return;
    const raw = fs.readFileSync(this.cacheFile, { encoding: 'utf-8' });
    this.cache = JSON.parse(raw);
  }

  private saveCache() {
    const raw = JSON.stringify(this.cache);
    fs.writeFileSync(this.cacheFile, raw, { encoding: 'utf-8' });
  }
}
