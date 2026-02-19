import { describe, it, beforeEach, mock, before } from 'node:test';
import assert from 'node:assert';
import { Comparator } from '../src/comparator.ts';
import type { DataSource, AssetMeta } from '../src/dataSource.ts';
import type { Reporter, SizeChange } from '../src/reporter.ts';
import { createMockAssetMeta, getBaseMetas, getChangedMetas, setupGetAssetMetas } from './mocks.ts';

describe('Comparator', () => {
  let mockDataSource: DataSource;
  let mockReporter: Reporter;
  let comparator: Comparator;

  const baseVersion = '37.0.0';
  const changedVersion = '38.0.0';

  const baseMetas: AssetMeta[] = getBaseMetas(baseVersion);
  const changedMetas: AssetMeta[] = getChangedMetas(changedVersion);

  beforeEach(() => {
    mock.reset();

    // Create mock functions
    const getAssetMetas = mock.fn();
    const getLatestVersions = mock.fn();
    const getPreviousVersion = mock.fn();
    const report = mock.fn();

    mockDataSource = {
      getAssetMetas,
      getLatestVersions,
      getPreviousVersion,
    };

    mockReporter = {
      report,
    };

    comparator = new Comparator(mockDataSource, mockReporter);
  });

  describe('constructor', () => {
    it('should initialize with default threshold', () => {
      const comp = new Comparator(mockDataSource, mockReporter);
      assert.ok(comp);
    });

    it('should accept custom threshold', () => {
      const customThreshold = 0.01; // 1%
      const comp = new Comparator(mockDataSource, mockReporter, customThreshold);
      assert.ok(comp);
    });
  });

  describe('compare', () => {
    beforeEach(() => {
      setupGetAssetMetas(baseMetas, changedMetas, mockDataSource);
    });

    it('should compare versions and return size changes', async () => {
      const changes = await comparator.compare(baseVersion, changedVersion);

      assert.strictEqual(changes.length, 4);
      assert.strictEqual(changes[0].base.targetPlatform, 'darwin-arm64');
      assert.strictEqual(changes[0].absolute, 5000000); // 5MB increase
      assert.strictEqual(changes[0].relative, 0.05); // 5% increase
    });

    it('should calculate relative changes correctly', async () => {
      const changes = await comparator.compare(baseVersion, changedVersion);

      const darwinChange = changes.find((c) => c.base.targetPlatform === 'darwin-arm64');
      assert.ok(darwinChange);
      assert.ok(Math.abs(darwinChange.relative - 0.05) < 0.01); // ~5%

      const win32Change = changes.find((c) => c.base.targetPlatform === 'win32-x64');
      assert.ok(win32Change);
      assert.ok(Math.abs(win32Change.relative - 0.00833) < 0.001); // ~0.83%

      const linuxChange = changes.find((c) => c.base.targetPlatform === 'linux-x64');
      assert.ok(linuxChange);
      assert.ok(Math.abs(linuxChange.relative - -0.00909) < 0.001); // ~-0.91%

      const win32Arm64Change = changes.find((c) => c.base.targetPlatform === 'win32-arm64');
      assert.ok(win32Arm64Change);
      assert.strictEqual(win32Arm64Change.relative, -0.11); // -11%
    });

    it('should report significant changes based on threshold', async () => {
      // Mock the cache to always return false (never cached)
      const mockCache = {
        has: mock.fn(() => false),
        put: mock.fn(),
      };
      (comparator as any).cache = mockCache;

      await comparator.compare(baseVersion, changedVersion);

      // With default threshold (0.04 = 4%), darwin-arm64 (5%) and win32-arm64 (-11%) are reported
      assert.strictEqual((mockReporter.report as any).mock.calls.length, 1);

      const reportedChanges = (mockReporter.report as any).mock.calls[0].arguments[0];
      assert.strictEqual(reportedChanges.length, 2);

      const darwinChange = reportedChanges.find(
        (c: any) => c.base.targetPlatform === 'darwin-arm64',
      );
      assert.ok(darwinChange);
      assert.strictEqual(darwinChange.relative, 0.05);

      const win32Arm64Change = reportedChanges.find(
        (c: any) => c.base.targetPlatform === 'win32-arm64',
      );
      assert.ok(win32Arm64Change);
      assert.strictEqual(win32Arm64Change.relative, -0.11);
    });

    it('should cache reported changes', async () => {
      // Mock the cache
      const mockCache = {
        has: mock.fn(() => false),
        put: mock.fn(),
      };
      (comparator as any).cache = mockCache;

      await comparator.compare(baseVersion, changedVersion);

      assert.ok((mockCache.put as any).mock.calls.length > 0);
    });

    it('should not report already cached changes', async () => {
      // Mock the cache to return true (already cached)
      const mockCache = {
        has: mock.fn(() => true),
        put: mock.fn(),
      };
      (comparator as any).cache = mockCache;

      await comparator.compare(baseVersion, changedVersion);

      assert.strictEqual((mockReporter.report as any).mock.calls.length, 0);
    });
  });

  describe('compare edge cases', () => {
    it('should handle platforms missing in changed version', async () => {
      const incompleteMetas = [
        createMockAssetMeta('darwin-arm64', changedVersion, 105000000),
        // Missing win32-x64 and linux-x64
      ];
      setupGetAssetMetas(baseMetas, incompleteMetas, mockDataSource);

      const changes = await comparator.compare(baseVersion, changedVersion);

      assert.strictEqual(changes.length, 1); // Only darwin-arm64 should be compared
      assert.strictEqual(changes[0].base.targetPlatform, 'darwin-arm64');
    });

    it('should not report changes below threshold', async () => {
      const smallChangeMetas = [
        createMockAssetMeta('darwin-arm64', changedVersion, 100100000), // +0.1%
        createMockAssetMeta('win32-x64', changedVersion, 120100000), // +0.083%
        createMockAssetMeta('linux-x64', changedVersion, 110100000), // +0.091%
      ];
      setupGetAssetMetas(baseMetas, smallChangeMetas, mockDataSource);

      await comparator.compare(baseVersion, changedVersion);

      // Check that report was not called
      assert.strictEqual((mockReporter.report as any).mock.calls.length, 0);
    });
  });

  describe('compareLatestVersions', () => {
    const latestVersions = ['v38.0.0', 'v37.2.5', 'v36.7.3'];

    it('should compare all latest versions with their previous versions', async () => {
      (mockDataSource.getLatestVersions as any).mock.mockImplementation(() =>
        Promise.resolve(latestVersions),
      );

      let prevCallCount = 0;
      (mockDataSource.getPreviousVersion as any).mock.mockImplementation(() => {
        const versions = ['v37.2.4', 'v37.2.4', 'v36.7.2'];
        return Promise.resolve(versions[prevCallCount++]);
      });

      (mockDataSource.getAssetMetas as any).mock.mockImplementation(() =>
        Promise.resolve([createMockAssetMeta('darwin-arm64', 'test', 100000000)]),
      );

      await comparator.compareLatestVersions();

      assert.strictEqual((mockDataSource.getLatestVersions as any).mock.calls.length, 1);
      assert.strictEqual((mockDataSource.getPreviousVersion as any).mock.calls.length, 3);
      assert.strictEqual((mockDataSource.getAssetMetas as any).mock.calls.length, 6); // 3 comparisons × 2 calls each
    });

    it('should return combined size changes from all comparisons', async () => {
      (mockDataSource.getLatestVersions as any).mock.mockImplementation(() =>
        Promise.resolve(latestVersions),
      );

      let prevCallCount = 0;
      (mockDataSource.getPreviousVersion as any).mock.mockImplementation(() => {
        const versions = ['v37.2.4', 'v37.2.4', 'v36.7.2'];
        return Promise.resolve(versions[prevCallCount++]);
      });

      (mockDataSource.getAssetMetas as any).mock.mockImplementation(() =>
        Promise.resolve([createMockAssetMeta('darwin-arm64', 'test', 100000000)]),
      );

      const changes = await comparator.compareLatestVersions();

      assert.strictEqual(changes.length, 3); // One change per comparison
      assert.ok(changes.every((change) => change.base && change.changed));
    });
  });

  describe('compareLatestVersions edge cases', () => {
    it('should skip versions without previous versions', async () => {
      const latestVersions = ['v38.0.0', 'v37.2.5', 'v36.7.3'];

      (mockDataSource.getLatestVersions as any).mock.mockImplementation(() =>
        Promise.resolve(latestVersions),
      );

      // Mock getPreviousVersion to skip the middle version
      let prevCallCount = 0;
      (mockDataSource.getPreviousVersion as any).mock.mockImplementation(() => {
        const versions = ['v37.2.4', undefined, 'v36.7.2']; // Skip middle version
        return Promise.resolve(versions[prevCallCount++]);
      });

      // Set up asset metas for the 2 successful comparisons only (4 calls total)
      (mockDataSource.getAssetMetas as any).mock.mockImplementation(() =>
        Promise.resolve([createMockAssetMeta('darwin-arm64', 'test', 100000000)]),
      );

      await comparator.compareLatestVersions();

      // Should only make 4 calls (2 comparisons × 2 calls each)
      assert.strictEqual((mockDataSource.getAssetMetas as any).mock.calls.length, 4);
    });
  });

  describe('custom threshold behavior', () => {
    beforeEach(() => {
      const baseMetas = [createMockAssetMeta('darwin-arm64', 'v37.0.0', 100000000)];
      const changedMetas = [createMockAssetMeta('darwin-arm64', 'v38.0.0', 105000000)]; // 5% change
      setupGetAssetMetas(baseMetas, changedMetas, mockDataSource);
    });

    it('should respect custom threshold for reporting', async () => {
      const highThreshold = 0.1; // 10%
      const strictComparator = new Comparator(mockDataSource, mockReporter, highThreshold);

      await strictComparator.compare('v37.0.0', 'v38.0.0');

      // 5% change should not be reported with 10% threshold
      assert.strictEqual((mockReporter.report as any).mock.calls.length, 0);
    });

    it('should report changes exceeding custom threshold', async () => {
      const lowThreshold = 0.01; // 1%
      const sensitiveComparator = new Comparator(mockDataSource, mockReporter, lowThreshold);

      // Mock the cache to always return false (never cached)
      const mockCache = {
        has: mock.fn(() => false),
        put: mock.fn(),
      };
      (sensitiveComparator as any).cache = mockCache;

      await sensitiveComparator.compare('v37.0.0', 'v38.0.0');

      // 2% change should be reported with 1% threshold
      assert.strictEqual((mockReporter.report as any).mock.calls.length, 1);
    });
  });
});
