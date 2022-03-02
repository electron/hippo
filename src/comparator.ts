import { AssetMeta, DataSource } from "./dataSource";
import { Reporter, SizeChange } from "./reporter";

class Comparator {
    private source: DataSource;
    private reporter: Reporter;

    constructor(source: DataSource, reporter: Reporter) {
        this.source = source;
        this.reporter = reporter;
    }

    async compare(baseVersion: string, changedVersion: string): Promise<SizeChange[]> {
        const sizeChanges = await this.fetchMetasAndCompare(baseVersion, changedVersion);
        return sizeChanges;
    }

    async compareLatestVersions(): Promise<SizeChange[]> {
        const latestVersions = await this.source.getLatestVersions();
        const sizeChanges = [];

        // latestVersions.map(async (latest) => {
        //     const previous = await this.source.getPreviousVersion(latest);
        //     if (!previous) return [];
        //     return await this.fetchMetasAndCompare(previous, latest);
        // });
    }

    private async fetchMetasAndCompare(baseVersion: string, changedVersion: string): Promise<SizeChange[]> {
        const baseMetas = await this.source.getAssetMetas(baseVersion);
        const changedMetas = await this.source.getAssetMetas(changedVersion);
        const comparableMetas = baseMetas
            .map((base) => ({ base, changed: changedMetas.find((m) => m.targetPlatform === base.targetPlatform) }))
            .filter(({ changed }) => !!changed) as { base: AssetMeta; changed: AssetMeta }[];

        return comparableMetas.map(({ base, changed }) => ({
            absolute: changed.sizeInBytes - base.sizeInBytes,
            base,
            changed,
            relative: (changed.sizeInBytes - base.sizeInBytes) / base.sizeInBytes,
        }));
    }
}
