import { IncomingWebhook } from "@slack/webhook";
import { AssetMeta } from "./dataSource";

export interface SizeChange {
    absolute: number;
    base: AssetMeta;
    changed: AssetMeta;
    relative: number;
}

export interface Reporter {
    report(changes: SizeChange[]): void;
}

export class SlackReporter implements Reporter {
    private webhook: IncomingWebhook;

    constructor(webhookUrl: string) {
        this.webhook = new IncomingWebhook(webhookUrl);
    }

    report(changes: SizeChange[]): void {
        const blocks = [this.generateHeaderBlock(), { type: "divider" }, ...changes.map(this.generateSectionBlock)];
        this.webhook.send({ blocks });
    }

    private generateHeaderBlock() {
        return {
            type: "section",
            text: { type: "mrkdwn", text: ":warning:  *significant electron binary size changes*  :hippopotamus:" },
        };
    }

    private generateSectionBlock({ absolute, base, changed, relative }: SizeChange) {
        const kb = (bytes: number) => Math.round(bytes / 1000);
        const sign = Math.sign(absolute) === 1 ? "+" : "-";
        const text =
            `*${base.version}  :arrow_right:  ${changed.version} \t :desktop_computer:  ${base.targetPlatform}*\n` +
            `${kb(base.sizeInBytes)} ${sign} ${Math.abs(kb(absolute))} -> ${kb(
                changed.sizeInBytes,
            )} KB *(${sign}${Math.abs(relative * 100).toFixed(2)} %)*`;
        return {
            text: { text, type: "mrkdwn" },
            type: "section",
        };
    }
}
