import 'dotenv/config';

import { Comparator } from './src/comparator.ts';
import { ElectronDataSource } from './src/dataSource.ts';
import { SlackReporter } from './src/reporter.ts';

const { SLACK_TOKEN, SLACK_CHANNEL_ID } = process.env;

const main = async () => {
  const source = new ElectronDataSource();
  const reporter = new SlackReporter(
    SLACK_TOKEN ?? 'invalid-token',
    SLACK_CHANNEL_ID ?? 'invalid-id',
  );

  const comparator = new Comparator(source, reporter);

  await comparator.compareLatestVersions();
};

main().catch((err) => {
  console.error(err);
});
