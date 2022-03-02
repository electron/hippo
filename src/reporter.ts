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
    private ccUsers: string[];
    private webhook: IncomingWebhook;

    constructor(webhookUrl: string, settings?: { ccUsers?: string[] }) {
        this.ccUsers = settings?.ccUsers ?? [];
        this.webhook = new IncomingWebhook(webhookUrl);
    }

    report(changes: SizeChange[]): void {
        const blocks = [
            this.generateHeaderBlock(),
            this.generateCcBlock(),
            { type: "divider" },
            ...changes.map(this.generateSectionBlock),
        ].filter((block) => !!block) as any;
        this.webhook.send({ blocks });
    }

    private generateHeaderBlock() {
        return {
            type: "section",
            text: { type: "mrkdwn", text: ":warning:  *significant electron binary size changes*  :hippopotamus:" },
        };
    }

    private generateCcBlock() {
        return this.ccUsers.length > 0
            ? {
                  type: "context",
                  elements: [
                      {
                          type: "mrkdwn",
                          text: `cc ${this.ccUsers.map((user) => `<@${user}>`).join(", ")}`,
                      },
                  ],
              }
            : undefined;
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
