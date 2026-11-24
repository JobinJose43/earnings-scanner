// Builds the static public site into ../site.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
if (!fs.existsSync(path.join(root, "public", "data", "snapshot.json"))) {
  console.error("No data: run `python snapshot.py ../frontend/public/data` in backend first.");
  process.exit(1);
}
execSync("npx react-scripts build", {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    REACT_APP_PUBLIC_MODE: "1",
    PUBLIC_URL: "",
    BUILD_PATH: path.resolve(root, "..", "site"),
    GENERATE_SOURCEMAP: "false",
  },
});
