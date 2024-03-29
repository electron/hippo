import { Sequelize, Model, DataTypes, Op } from 'sequelize';
import * as semver from 'semver';

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

// include versions published in last x days
const VERSION_RANGE_IN_DAYS = 60;

// distsize table orm
class ElectronDistSize extends Model {
  declare platformArch: string;
  declare size: number;
  declare version: string;
}

// electron dist binaries source using postgres database
export class ElectronDataSource implements DataSource {
  // db connection
  private sequelize: Sequelize;

  constructor(postgresUri: string) {
    this.sequelize = new Sequelize(postgresUri, {
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      logging: process.env.NODE_ENV === 'dev',
    });
    this.registerOrmModels();
  }

  async closeConnection(): Promise<void> {
    await this.sequelize.close();
  }

  async getAssetMetas(version: string): Promise<AssetMeta[]> {
    const distSizes = await ElectronDistSize.findAll({
      attributes: ['platformArch', 'size'],
      where: {
        assetName: 'electron',
        suffix: 'dist',
        version,
      },
    });
    return distSizes.map(({ size, platformArch }) => ({
      sizeInBytes: size,
      targetPlatform: platformArch,
      version,
    }));
  }

  async getLatestVersions(): Promise<string[]> {
    const versions = await this.fetchVersions();
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
    const versions = await this.fetchVersions();
    versions.sort(semver.compare);

    const index = versions.indexOf(ofVersion);
    return index > 0 ? versions[index - 1] : undefined;
  }

  // fetch versions published in last x days
  private async fetchVersions(rangeInDays: number = VERSION_RANGE_IN_DAYS): Promise<string[]> {
    const distSizes = await ElectronDistSize.findAll({
      attributes: ['version'],
      group: ['version'],
      where: {
        assetName: 'electron',
        released: { [Op.gt]: this.convertRangeToDate(rangeInDays) },
        suffix: 'dist',
      },
    });
    return distSizes.map(({ version }) => version);
  }

  // convert range in days to date
  private convertRangeToDate(rangeInDays: number): Date {
    const milliseconds = 1000 * 60 * 60 * 24 * rangeInDays;
    return new Date(Date.now() - milliseconds);
  }

  private registerOrmModels(): void {
    ElectronDistSize.init(
      {
        arch: DataTypes.STRING,
        assetId: {
          primaryKey: true,
          type: DataTypes.INTEGER,
        },
        assetName: DataTypes.STRING,
        platform: DataTypes.STRING,
        platformArch: DataTypes.STRING,
        released: DataTypes.DATE,
        size: DataTypes.INTEGER,
        suffix: DataTypes.STRING,
        version: DataTypes.STRING,
      },
      {
        modelName: 'DistSize',
        sequelize: this.sequelize,
        tableName: 'dist_size',
        timestamps: false,
        underscored: true,
      },
    );
  }
}
