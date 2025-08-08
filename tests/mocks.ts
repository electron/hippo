import { mock } from 'node:test';
import type { DataSource, AssetMeta } from '../src/dataSource.ts';

export const createMockAssetMeta = (
  platform: string,
  version: string,
  size: number,
): AssetMeta => ({
  sizeInBytes: size,
  targetPlatform: platform,
  version,
});

export const getBaseMetas = (baseVersion: string): AssetMeta[] => {
  return [
    createMockAssetMeta('darwin-arm64', baseVersion, 100000000), // 100MB
    createMockAssetMeta('win32-x64', baseVersion, 120000000), // 120MB
    createMockAssetMeta('linux-x64', baseVersion, 110000000), // 110MB
  ];
};

export const getChangedMetas = (changedVersion: string): AssetMeta[] => {
  return [
    createMockAssetMeta('darwin-arm64', changedVersion, 105000000), // 105MB (+5MB, +5%)
    createMockAssetMeta('win32-x64', changedVersion, 121000000), // 121MB (+1MB, ~0.83%)
    createMockAssetMeta('linux-x64', changedVersion, 109000000), // 109MB (-1MB, ~-0.91%)
  ];
};

// Helper function to generate dates within the last 60 days
export const generateRecentDate = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

export const setupGetAssetMetas = (
  baseMetas: AssetMeta[],
  changedMetas: AssetMeta[],
  mockDataSource: DataSource,
): void => {
  let callCount = 0;
  (mockDataSource.getAssetMetas as any) = mock.fn(async () => {
    if (callCount === 0) {
      callCount++;
      return Promise.resolve(baseMetas);
    }
    return Promise.resolve(changedMetas);
  });
};
