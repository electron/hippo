import "dotenv/config";
import { Comparator } from "./src/comparator";
import { ElectronDataSource } from "./src/dataSource";
import { SlackReporter } from "./src/reporter";

(async () => {
    const source = new ElectronDataSource(process.env.POSTGRES_URI ?? "invalid-uri");
    const reporter = new SlackReporter(process.env.SLACK_WEBHOOK ?? "invalid-uri");
    const comparator = new Comparator(source, reporter);

    await source.closeConnection();
})();
