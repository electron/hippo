import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { ElectronDataSource } from '../src/dataSource.ts';
import { generateRecentDate } from './mocks.ts';

describe('ElectronDataSource', () => {
  let dataSource: ElectronDataSource;

  beforeEach(() => {
    mock.reset();
    dataSource = new ElectronDataSource();
    const mockReleases = [
      { version: '38.0.0', date: generateRecentDate(4) },
      { version: '37.2.5', date: generateRecentDate(8) },
      { version: '36.7.3', date: generateRecentDate(11) },
      { version: '39.0.0-nightly.20250805', date: generateRecentDate(0) },
      { version: '38.0.0-alpha.1', date: generateRecentDate(6) },
    ];
    // Override the releases property
    (dataSource as any).releases = mockReleases;
  });

  describe('constructor', () => {
    it('should initialize with default API URL', () => {
      const defaultDataSource = new ElectronDataSource();
      assert.ok(defaultDataSource);
    });

    it('should accept custom API URL', () => {
      const customUrl = 'https://custom-api.electron.build';
      const customDataSource = new ElectronDataSource(customUrl);
      assert.ok(customDataSource);
    });

    it('should accept GitHub token', () => {
      const token = 'github_token_123';
      const tokenDataSource = new ElectronDataSource(undefined, token);
      assert.ok(tokenDataSource);
    });
  });

  describe('getLatestVersions', () => {
    it('should fetch and return latest versions', async () => {
      const versions = await dataSource.getLatestVersions();
      assert.ok(Array.isArray(versions));
      assert.ok(versions.length > 0);
      assert.ok(versions.includes('38.0.0'));
      assert.ok(versions.includes('37.2.5'));
      assert.ok(versions.includes('36.7.3'));
      assert.ok(versions.includes('39.0.0-nightly.20250805'));
      //38.0.0 is newer so the alpha should not be returned.
      assert.ok(!versions.includes('38.0.0-alpha.1'));
    });

    it('should include nightly versions', async () => {
      const versions = await dataSource.getLatestVersions();
      const nightlyVersions = versions.filter((v) => v.includes('nightly'));

      assert.ok(nightlyVersions.length > 0);
    });

    it('should sort versions correctly', async () => {
      const versions = await dataSource.getLatestVersions();
      // Should include major versions in descending order
      const majorVersions = versions.filter(
        (v) => !v.includes('nightly') && !v.includes('alpha') && !v.includes('beta'),
      );
      assert.strictEqual(majorVersions[0], '38.0.0');
    });

    it('should handle API errors gracefully', async () => {
      // Force an error by setting releases to undefined
      (dataSource as any).releases = undefined;

      // Override fetchReleases to throw
      (dataSource as any).fetchReleases = async () => {
        throw new Error('API Error');
      };

      await assert.rejects(
        () => dataSource.getLatestVersions(),
        (error: Error) => error.message.includes('API Error'),
      );
    });
  });

  describe('getPreviousVersion', () => {
    it('should return the previous version', async () => {
      const previousVersion = await dataSource.getPreviousVersion('38.0.0');
      assert.strictEqual(previousVersion, '38.0.0-alpha.1');
    });

    it('should return undefined for the oldest version', async () => {
      const previousVersion = await dataSource.getPreviousVersion('36.7.3');
      assert.strictEqual(previousVersion, undefined);
    });

    it('should return undefined for non-existent version', async () => {
      const previousVersion = await dataSource.getPreviousVersion('99.0.0');
      assert.strictEqual(previousVersion, undefined);
    });
  });

  describe('getAssetMetas', () => {
    const mockAssets = [
      {
        name: 'electron-v38.0.0-darwin-arm64.zip',
        size: 100000000,
      },
      {
        name: 'electron-v38.0.0-darwin-x64.zip',
        size: 110000000,
      },
      {
        name: 'electron-v38.0.0-win32-x64.zip',
        size: 120000000,
      },
      {
        name: 'electron-v38.0.0-linux-x64.zip',
        size: 115000000,
      },
      {
        name: 'electron-v38.0.0-symbols-darwin-arm64.zip',
        size: 50000000,
      },
      {
        name: 'chromedriver-v38.0.0-darwin-arm64.zip',
        size: 10000000,
      },
    ];

    it('should return empty array when GitHub API not available', async () => {
      // Mock octokit to simulate API unavailability
      (dataSource as any).octokit = undefined;

      const assetMetas = await dataSource.getAssetMetas('33.0.0');

      assert.ok(Array.isArray(assetMetas));
      assert.strictEqual(assetMetas.length, 0);
    });

    it('should fetch asset metadata from GitHub', async () => {
      // Set up a mock octokit that returns the mock assets
      (dataSource as any).octokit = {
        rest: {
          repos: {
            getReleaseByTag: mock.fn(() =>
              Promise.resolve({
                data: {
                  assets: mockAssets,
                },
              }),
            ),
          },
        },
      };

      const metas = await dataSource.getAssetMetas('38.0.0');

      assert.strictEqual(metas.length, 4); // Should exclude symbols and chromedriver
      const platforms = metas.map((m) => m.targetPlatform);
      assert.ok(platforms.includes('darwin-arm64'));
      assert.ok(platforms.includes('darwin-x64'));
      assert.ok(platforms.includes('win32-x64'));
      assert.ok(platforms.includes('linux-x64'));
    });

    it('should filter out non-distribution assets', async () => {
      (dataSource as any).octokit = {
        rest: {
          repos: {
            getReleaseByTag: mock.fn(() =>
              Promise.resolve({
                data: {
                  assets: mockAssets,
                },
              }),
            ),
          },
        },
      };

      const metas = await dataSource.getAssetMetas('38.0.0');

      assert.ok(metas.every((m) => !m.targetPlatform.includes('symbols')));
      assert.ok(metas.every((m) => !m.targetPlatform.includes('chromedriver')));
    });

    it('should handle version tags with and without v prefix', async () => {
      const mockGetRelease = mock.fn(() =>
        Promise.resolve({
          data: { assets: mockAssets },
        }),
      );

      (dataSource as any).octokit = {
        rest: {
          repos: {
            getReleaseByTag: mockGetRelease,
          },
        },
      };

      // Test with v prefix
      const metasWithV = await dataSource.getAssetMetas('v38.0.0');
      assert.strictEqual(metasWithV.length, 4);

      // Test without v prefix
      const metasWithoutV = await dataSource.getAssetMetas('38.0.0');
      assert.strictEqual(metasWithoutV.length, 4);
    });

    it('should return fallback data when GitHub API fails', async () => {
      // Set up a mock octokit that throws an error
      (dataSource as any).octokit = {
        rest: {
          repos: {
            getReleaseByTag: mock.fn(() => Promise.reject(new Error('API Error'))),
          },
        },
      };

      const metas = await dataSource.getAssetMetas('38.0.0');

      assert.ok(Array.isArray(metas));
      assert.strictEqual(metas.length, 0); // Should return empty array when GitHub API fails
    });

    it('should extract platform information correctly', async () => {
      (dataSource as any).octokit = {
        rest: {
          repos: {
            getReleaseByTag: mock.fn(() =>
              Promise.resolve({
                data: {
                  assets: mockAssets,
                },
              }),
            ),
          },
        },
      };

      const metas = await dataSource.getAssetMetas('38.0.0');

      const platforms = metas.map((m) => m.targetPlatform);
      assert.ok(platforms.includes('darwin-arm64'));
      assert.ok(platforms.includes('darwin-x64'));
      assert.ok(platforms.includes('win32-x64'));
      assert.ok(platforms.includes('linux-x64'));
    });

    it('should return correct size information', async () => {
      (dataSource as any).octokit = {
        rest: {
          repos: {
            getReleaseByTag: mock.fn(() =>
              Promise.resolve({
                data: {
                  assets: mockAssets,
                },
              }),
            ),
          },
        },
      };

      const metas = await dataSource.getAssetMetas('38.0.0');

      const darwinArm64 = metas.find((m) => m.targetPlatform === 'darwin-arm64');
      assert.strictEqual(darwinArm64?.sizeInBytes, 100000000);

      const win32x64 = metas.find((m) => m.targetPlatform === 'win32-x64');
      assert.strictEqual(win32x64?.sizeInBytes, 120000000);
    });
  });
});
