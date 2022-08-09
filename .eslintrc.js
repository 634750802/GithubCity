module.exports = {
    root: true,
    env: {
        browser: true,
        es2021: true,
    },
    extends: ["standard", "prettier", "plugin:@typescript-eslint/recommended"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
    },
    plugins: ["simple-import-sort", "import", "@typescript-eslint"],
    rules: {
        indent: ["error", 4],
        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "error",
        "import/first": "error",
        "import/newline-after-import": "error",
        "import/no-duplicates": "error",
    },
};
