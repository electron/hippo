import 'dotenv/config';
import { Comparator } from './src/comparator';
import { ElectronDataSource } from './src/dataSource';
import { SlackReporter } from './src/reporter';

const { SLACK_TOKEN, SLACK_CHANNEL_ID, POSTGRES_URI } = process.env;

const main = async () => {
  const source = new ElectronDataSource(POSTGRES_URI ?? 'invalid-uri');
  const reporter = new SlackReporter(
    SLACK_TOKEN ?? 'invalid-token',
    SLACK_CHANNEL_ID ?? 'invalid-id',
  );

  const comparator = new Comparator(source, reporter);

  await comparator.compareLatestVersions();
  await source.closeConnection();
};

main().catch((err) => {
  console.error(err);
});
