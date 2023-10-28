import "dotenv/config";
import { Comparator } from "./src/comparator";
import { ElectronDataSource } from "./src/dataSource";
import { SlackReporter } from "./src/reporter";

// main
(async () => {
  // parse args
  const ccUsers = process.env.CC_USERS ? process.env.CC_USERS.split(",") : undefined;

  // init comparator
  const source = new ElectronDataSource(process.env.POSTGRES_URI ?? "invalid-uri");
  const reporter = new SlackReporter(
    process.env.SLACK_TOKEN ?? "invalid-token",
    process.env.SLACK_CHANNEL_ID ?? "invalid-id",
    { ccUsers },
  );
  const comparator = new Comparator(source, reporter);

  // run & cleanup
  await comparator.compareLatestVersions();
  await source.closeConnection();
})();
