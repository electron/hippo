import { type AssetMeta } from './dataSource.ts';

export interface SizeChange {
  absolute: number;
  base: AssetMeta;
  changed: AssetMeta;
  relative: number;
}

export interface Reporter {
  report(changes: SizeChange[]): void;
}

interface ChatPostMessageArguments {
  blocks: {
    type: string;
    text: {
      type: string;
      text: string;
    };
  }[];
  channel: string;
  text: string;
  thread_ts?: string;
}

interface ChatPostMessageResponseMessage {
  ts?: string;
}

interface ChatPostMessageResponse {
  error?: string;
  message?: ChatPostMessageResponseMessage;
  ok?: boolean;
}

export class SlackReporter implements Reporter {
  private slackChannelId: string;
  private slackToken: string;

  constructor(slackToken: string, slackChannelId: string) {
    this.slackToken = slackToken;
    this.slackChannelId = slackChannelId;
  }

  async report(changes: SizeChange[]) {
    const { message } = await this.postChatMessage({
      blocks: [this.generateHeaderBlock()],
      channel: this.slackChannelId,
      text: this.getHeaderText(),
    });

    if (message) {
      this.postChatMessage({
        blocks: changes.map(this.generateSectionBlock),
        channel: this.slackChannelId,
        text: '(see message for details)',
        thread_ts: message.ts,
      });
    }
  }

  private getHeaderText() {
    return ':warning:  *significant electron binary size changes*  :hippopotamus:';
  }

  private generateHeaderBlock() {
    return {
      type: 'section',
      text: { type: 'mrkdwn', text: this.getHeaderText() },
    };
  }

  private generateSectionBlock({ absolute, base, changed, relative }: SizeChange) {
    const kb = (bytes: number) => Math.round(bytes / 1000);
    const sign = Math.sign(absolute) === 1 ? '+' : '-';
    const text =
      `*${base.version}  :arrow_right:  ${changed.version} \t :desktop_computer:  ${base.targetPlatform}*\n` +
      `${kb(base.sizeInBytes)} ${sign} ${Math.abs(kb(absolute))} -> ${kb(
        changed.sizeInBytes,
      )} KB *(${sign}${Math.abs(relative * 100).toFixed(2)} %)*`;
    return {
      text: { text, type: 'mrkdwn' },
      type: 'section',
    };
  }

  private async postChatMessage({
    blocks,
    channel,
    text,
    thread_ts,
  }: ChatPostMessageArguments): Promise<ChatPostMessageResponse> {
    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.slackToken}`,
      },
      body: JSON.stringify({
        blocks,
        channel,
        text,
        thread_ts,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Failed to post message to Slack: ${resp.statusText}`);
    }

    const { ok, error, ...payload } = await resp.json();

    if (!ok) {
      throw new Error(`Slack API error: ${payload.error}`);
    }

    return payload;
  }
}
