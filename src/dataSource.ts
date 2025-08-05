import * as semver from 'semver';
import { Octokit } from '@octokit/rest';

export interface AssetMeta {
  sizeInBytes: number;
  targetPlatform: string;
  version: string;
}

export interface DataSource {
  getAssetMetas(version: string): Promise<AssetMeta[]>;
  getLatestVersions(): Promise<string[]>;
  getPreviousVersion(ofVersion: string): Promise<string | undefined>;
}

interface ElectronRelease {
  version: string;
  date: string;
  files: string[];
  node: string;
  v8: string;
  uv: string;
  zlib: string;
  openssl: string;
  modules: string;
  lts: boolean;
  security: boolean;
}

// include versions published in last x days
const VERSION_RANGE_IN_DAYS = 60;

const ASSET_REGEX =
  /^electron-(v[0-9]+\.[0-9]+\.[0-9]+(?:-(?:alpha|beta|nightly).[0-9]+)?)-(.+?)-(.+?)(?:-(.+?))?\.zip$/;

// electron dist binaries source using the electron headers JSON data
export class ElectronDataSource implements DataSource {
  private apiUrl: string;
  private releases: ElectronRelease[] | null = null;
  private octokit: Octokit;

  constructor(apiUrl: string = 'https://electronjs.org/headers/index.json', githubToken?: string) {
    this.apiUrl = apiUrl;
    this.octokit = new Octokit({
      auth: githubToken,
    });
  }

  async getAssetMetas(version: string): Promise<AssetMeta[]> {
    const assetMetas: AssetMeta[] = [];
    try {
      let tag = version;
      if (!version.startsWith('v')) {
        tag = `v${version}`;
      }

      // Get release data from GitHub API
      const release = await this.octokit.rest.repos.getReleaseByTag({
        owner: 'electron',
        repo: version.includes('nightly') ? 'nightlies' : 'electron',
        tag: tag,
      });

      // Filter and map assets to AssetMeta format
      for (const asset of release.data.assets) {
        const match = ASSET_REGEX.exec(asset.name);
        if (!match || match[4]) continue;
        const targetPlatform = `${match[2]}-${match[3]}`;
        assetMetas.push({
          sizeInBytes: asset.size,
          targetPlatform,
          version,
        });
      }
    } catch (error) {
      console.error(`Error fetching assets for version ${version}:`, error);
    }
    return assetMetas;
  }

  async getLatestVersions(): Promise<string[]> {
    const releases = await this.fetchReleases();
    const versions = releases.map((release) => release.version);
    versions.sort(semver.rcompare);

    // is nightly predicate & filter nightlies
    const isNightly = (version: string) => {
      const pre = semver.prerelease(version);
      return pre && pre.length > 1 && pre[0] === 'nightly';
    };
    const nonNightlies = versions.filter((v) => !isNightly(v));

    // stable, alpha, beta
    const majorLines = [...new Set(nonNightlies.map((v) => semver.major(v)))];
    const latestVersions = majorLines.map(
      (majorVer) => nonNightlies.find((v) => semver.major(v) === majorVer)!,
    );

    // nightlies (only latest)
    const nightly = versions.find(isNightly);
    if (nightly) latestVersions.push(nightly);

    return latestVersions;
  }

  async getPreviousVersion(ofVersion: string): Promise<string | undefined> {
    const releases = await this.fetchReleases();
    const versions = releases.map((release) => release.version);
    versions.sort(semver.compare);

    const index = versions.indexOf(ofVersion);
    return index > 0 ? versions[index - 1] : undefined;
  }

  // fetch releases from the electron headers API
  private async fetchReleases(): Promise<ElectronRelease[]> {
    if (this.releases) {
      return this.releases;
    }
    try {
      const response = await fetch(this.apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch releases: ${response.status} ${response.statusText}`);
      }

      const releases: ElectronRelease[] = await response.json();

      // Filter releases by date range (last x days)
      const cutoffDate = this.convertRangeToDate(VERSION_RANGE_IN_DAYS);

      this.releases = releases.filter((release) => {
        const releaseDate = new Date(release.date);
        return releaseDate > cutoffDate;
      });
      return this.releases;
    } catch (error) {
      console.error('Error fetching electron releases:', error);
      throw error;
    }
  }

  // convert range in days to date
  private convertRangeToDate(rangeInDays: number): Date {
    const milliseconds = 1000 * 60 * 60 * 24 * rangeInDays;
    return new Date(Date.now() - milliseconds);
  }
}
