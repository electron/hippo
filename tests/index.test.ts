import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import type { Reporter, SizeChange } from '../src/reporter.ts';
import { Comparator } from '../src/comparator.ts';
import { ElectronDataSource } from '../src/dataSource.ts';
import type { AssetMeta } from '../src/dataSource.ts';
import { CACHE_FILE } from '../src/cache.ts';
import * as fs from 'node:fs';
import { generateRecentDate, getBaseMetas, getChangedMetas, setupGetAssetMetas } from './mocks.ts';

// Mock Reporter implementation for testing
class MockReporter implements Reporter {
  public reportCalls: SizeChange[][] = [];
  public reportFn = mock.fn();

  report(changes: SizeChange[]): void {
    this.reportCalls.push(changes);
    this.reportFn.mock.mockImplementation(() => {
      // Mock implementation - just record the call
    });
    this.reportFn();
  }

  // Helper methods for testing
  getCallCount(): number {
    return this.reportCalls.length;
  }

  getLastCall(): SizeChange[] | undefined {
    return this.reportCalls[this.reportCalls.length - 1];
  }

  reset(): void {
    this.reportCalls = [];
    mock.reset();
    this.reportFn = mock.fn();
  }
}

describe('main application', () => {
  let mockReporter: MockReporter;

  beforeEach(() => {
    // Clean up any existing cache file
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
    // Create fresh mock reporter for each test
    mockReporter = new MockReporter();
  });

  afterEach(() => {
    // Reset mock reporter
    mockReporter.reset();
  });

  describe('main application integration', () => {
    it('should support main application pattern with mock reporter', async () => {
      // Test the main application initialization pattern but with mock reporter
      try {
        const source = new ElectronDataSource();
        const reporter = mockReporter; // Use mock instead of SlackReporter
        const comparator = new Comparator(source, reporter);
        await comparator.compareLatestVersions();

        // Verify all components are created successfully
        assert.ok(source);
        assert.ok(reporter);
        assert.ok(comparator);
      } catch (error) {
        assert.fail(`Should support main application pattern: ${error}`);
      }
    });

    it('should report size changes using mock reporter', async () => {
      const source = new ElectronDataSource();
      const baseVersion = '37.0.0';
      const changedVersion = '38.0.0';
      const mockReleases = [
        { version: changedVersion, date: generateRecentDate(4) },
        { version: baseVersion, date: generateRecentDate(8) },
      ];
      // Override the releases property
      (source as any).releases = mockReleases;

      // Mock the getAssetMetas method
      const baseMetas: AssetMeta[] = getBaseMetas(baseVersion);
      const changedMetas: AssetMeta[] = getChangedMetas(changedVersion);

      setupGetAssetMetas(baseMetas, changedMetas, source);

      let callCount = 0;
      source.getAssetMetas = mock.fn(async () => {
        if (callCount === 0) {
          callCount++;
          return baseMetas;
        }
        return changedMetas;
      });

      const reporter = mockReporter;
      const comparator = new Comparator(source, reporter);
      await comparator.compareLatestVersions();

      // Verify that the reporter was called with size changes
      assert.strictEqual(reporter.getCallCount(), 1);
      const lastCallChanges = reporter.getLastCall();

      assert.ok(lastCallChanges);
      // With the 2% threshold, darwin-arm64 (+5%) and win32-arm64 (-11%) exceed it;
      // win32-x64 (~0.83%) and linux-x64 (~-0.91%) do not
      assert.strictEqual(lastCallChanges.length, 2, 'Expected 2 size changes to be reported');

      // Assert darwin-arm64 changes (increase from 100MB to 105MB, +5%)
      const darwinChange = lastCallChanges.find(
        (change) => change.base.targetPlatform === 'darwin-arm64',
      );
      assert.ok(darwinChange, 'Expected darwin-arm64 change');
      assert.strictEqual(darwinChange.base.sizeInBytes, 100000000);
      assert.strictEqual(darwinChange.changed.sizeInBytes, 105000000);
      assert.strictEqual(darwinChange.absolute, 5000000);
      assert.strictEqual(darwinChange.relative, 0.05);

      // Assert win32-arm64 changes (decrease from 100MB to 89MB, -11%)
      const win32Arm64Change = lastCallChanges.find(
        (change) => change.base.targetPlatform === 'win32-arm64',
      );
      assert.ok(win32Arm64Change, 'Expected win32-arm64 change');
      assert.strictEqual(win32Arm64Change.base.sizeInBytes, 100000000);
      assert.strictEqual(win32Arm64Change.changed.sizeInBytes, 89000000);
      assert.strictEqual(win32Arm64Change.absolute, -11000000);
      assert.strictEqual(win32Arm64Change.relative, -0.11);
    });
  });
});
