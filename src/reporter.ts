import { WebClient as SlackClient } from "@slack/web-api";
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
    private slack: SlackClient;
    private slackChannelId: string;

    constructor(slackToken: string, slackChannelId: string, settings?: { ccUsers?: string[] }) {
        this.ccUsers = settings?.ccUsers ?? [];
        this.slack = new SlackClient(slackToken);
        this.slackChannelId = slackChannelId;
    }

    async report(changes: SizeChange[]) {
        // main message
        const { message } = await this.slack.chat.postMessage({
            blocks: [this.generateHeaderBlock(), this.generateCcBlock(), { type: "divider" }].filter(
                (block) => !!block,
            ) as any,
            channel: this.slackChannelId,
            text: this.getHeaderText(),
        });

        // threaded details
        if (message) {
            this.slack.chat.postMessage({
                blocks: changes.map(this.generateSectionBlock),
                channel: this.slackChannelId,
                text: "(see message for details)",
                thread_ts: message.ts,
            });
        }
    }

    private getHeaderText() {
        return ":warning:  *significant electron binary size changes*  :hippopotamus:";
    }

    private generateHeaderBlock() {
        return {
            type: "section",
            text: { type: "mrkdwn", text: this.getHeaderText() },
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
