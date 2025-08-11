module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "quotes": ["error", "double", { "allowTemplateLiterals": true }],
    "object-curly-spacing": ["error", "always"],
    "require-jsdoc": "off",
  },
  ignorePatterns: ["node_modules/", ".eslintrc.cjs"],
};
