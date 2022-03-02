import { AssetMeta } from "./dataSource";

export interface SizeChange {
    absolute: number;
    base: AssetMeta;
    changed: AssetMeta;
    relative: number;
}

export interface Reporter {
    report(change: SizeChange): void;
}

class SlackReporter implements Reporter {
    constructor(webhookUrl: string) {}

    report(change: SizeChange): void {
        throw new Error("Method not implemented.");
    }
}
