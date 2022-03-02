import "dotenv/config";
import { ElectronDataSource } from "./src/dataSource";

(async () => {
    const source = new ElectronDataSource();
    console.log(await source.getLatestVersions());

    await source.closeConnection();
})();
