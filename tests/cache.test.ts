import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FileCache } from '../src/cache.ts';
import * as fs from 'node:fs';

describe('FileCache', () => {
  let cache: FileCache;
  const testCacheFile = '.test-cache';

  beforeEach(() => {
    // Clean up any existing test file
    if (fs.existsSync(testCacheFile)) {
      fs.unlinkSync(testCacheFile);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testCacheFile)) {
      fs.unlinkSync(testCacheFile);
    }
  });

  describe('constructor', () => {
    it('should create cache with default file path', () => {
      const defaultCache = new FileCache();
      assert.ok(defaultCache);
    });

    it('should create cache with custom file path', () => {
      const customCache = new FileCache('/custom/path');
      assert.ok(customCache);
    });

    it('should load existing cache file on initialization', () => {
      const mockData = ['key1', 'key2', 'key3'];
      // Create a test file with mock data
      fs.writeFileSync(testCacheFile, JSON.stringify(mockData), { encoding: 'utf-8' });

      const loadedCache = new FileCache(testCacheFile);

      // Verify the cache loaded the data
      assert.strictEqual(loadedCache.has('key1'), true);
      assert.strictEqual(loadedCache.has('key2'), true);
      assert.strictEqual(loadedCache.has('key3'), true);
    });

    it('should handle missing cache file gracefully', () => {
      const newCache = new FileCache(testCacheFile);
      assert.strictEqual(newCache.has('nonexistent'), false);
    });
  });

  describe('has', () => {
    beforeEach(() => {
      cache = new FileCache(testCacheFile);
    });

    it('should return false for non-existent keys', () => {
      assert.strictEqual(cache.has('nonexistent'), false);
    });

    it('should return true for existing keys after put', () => {
      cache.put('existing-key');
      assert.strictEqual(cache.has('existing-key'), true);
      assert.strictEqual(cache.has('non-existing-key'), false);
    });
  });

  describe('put', () => {
    beforeEach(() => {
      cache = new FileCache(testCacheFile);
    });

    it('should add new key to cache', () => {
      const key = 'new-key';
      cache.put(key);
      assert.strictEqual(cache.has(key), true);
    });

    it('should not add duplicate keys', () => {
      const key = 'duplicate-key';
      cache.put(key);
      cache.put(key); // Try to add the same key again
      assert.strictEqual(cache.has(key), true);
    });

    it('should persist cache to file system', () => {
      const keys = ['key1', 'key2', 'key3'];
      keys.forEach((key) => cache.put(key));

      // Verify file was created
      assert.ok(fs.existsSync(testCacheFile));

      // Verify content
      const fileContent = fs.readFileSync(testCacheFile, { encoding: 'utf-8' });
      const savedKeys = JSON.parse(fileContent);
      assert.deepStrictEqual(savedKeys, keys);
    });

    it('should maintain order of inserted keys', () => {
      const keys = ['first', 'second', 'third'];
      keys.forEach((key) => cache.put(key));

      const fileContent = fs.readFileSync(testCacheFile, { encoding: 'utf-8' });
      const savedKeys = JSON.parse(fileContent);
      assert.deepStrictEqual(savedKeys, keys);
    });
  });

  describe('integration scenarios', () => {
    it('should work with complex JSON strings as keys', () => {
      const complexCache = new FileCache(testCacheFile);
      const complexKey = JSON.stringify({
        version: 'v38.0.0',
        platform: 'darwin-arm64',
        size: 100000000,
      });

      complexCache.put(complexKey);
      assert.strictEqual(complexCache.has(complexKey), true);

      const fileContent = fs.readFileSync(testCacheFile, { encoding: 'utf-8' });
      const savedKeys = JSON.parse(fileContent);
      assert.deepStrictEqual(savedKeys, [complexKey]);
    });

    it('should handle cache persistence and loading cycle', () => {
      const initialData = ['persisted-key1', 'persisted-key2'];

      // First: create cache and add data
      const firstCache = new FileCache(testCacheFile);
      initialData.forEach((key) => firstCache.put(key));

      // Second: load existing cache
      const persistentCache = new FileCache(testCacheFile);

      // Verify existing data is loaded
      assert.strictEqual(persistentCache.has('persisted-key1'), true);
      assert.strictEqual(persistentCache.has('persisted-key2'), true);

      // Add new data
      persistentCache.put('new-key');

      // Verify all data is present
      assert.strictEqual(persistentCache.has('persisted-key1'), true);
      assert.strictEqual(persistentCache.has('persisted-key2'), true);
      assert.strictEqual(persistentCache.has('new-key'), true);

      // Verify file content
      const fileContent = fs.readFileSync(testCacheFile, { encoding: 'utf-8' });
      const savedKeys = JSON.parse(fileContent);
      assert.deepStrictEqual(savedKeys, [...initialData, 'new-key']);
    });
  });
});
