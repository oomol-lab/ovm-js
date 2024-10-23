import fsP from "node:fs/promises";
import os from "node:os";
import path, { dirname } from "node:path";
import cp from "node:child_process";
import { fileURLToPath } from "node:url";
import fs, { constants } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workspace = await fsP.mkdtemp(path.join(os.tmpdir(), "ovm-download-"));

await Promise.all([
    fsP.cp(path.join(__dirname, "download.mjs"), path.join(workspace, "download.mjs"), { force: true }),
    fsP.cp(path.join(__dirname, "resource.json"), path.join(workspace, "resource.json"), { force: true }),
    fsP.cp(path.join(__dirname, "package.json"), path.join(workspace, "package.json"), { force: true }),
    fsP.cp(path.join(__dirname, "package-lock.json"), path.join(workspace, "package-lock.json"), { force: true }),
])

cp.execSync("npm install", {
    cwd: workspace,
    encoding: "utf-8",
    shell: true,
    stdio: "inherit",
});

cp.execSync("node download.mjs", {
    cwd: workspace,
    encoding: "utf-8",
    shell: true,
    stdio: "inherit",
});

fs.access(path.join(workspace, "vm-resources"), constants.F_OK, async (err) => {
    if (!err) {
        console.log(`[OVM]: Move ${path.join(workspace, "vm-resources")} to ${path.join(__dirname, "..", "vm-resources")}`);
        await fsP.cp(path.join(workspace, "vm-resources"), path.join(__dirname, "..", "vm-resources"), {
            recursive: true,
            force: true,
            preserveTimestamps: true,
        });
    }

    await fsP.rm(workspace, { recursive: true, force: true });
});
