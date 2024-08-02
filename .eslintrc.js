module.exports = {
    extends: ["@oomol-lab/eslint-config-basic", "@oomol-lab/eslint-config-ts"],
    parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
    },
    ignorePatterns: [
        ".vscode",
        ".idea",
        "out",
        ".github",
        "*.yml",
        "scripts",
    ],
};
