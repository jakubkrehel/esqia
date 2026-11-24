import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

const restrictedImports = {
  paths: [
    {
      allowTypeImports: true,
      importNames: ["default", "memo", "useMemo", "useCallback"],
      message:
        "Use named React imports without memo/useMemo/useCallback; React Compiler handles memoization.",
      name: "react",
    },
  ],
  patterns: [
    {
      group: ["@radix-ui/*", "!@radix-ui/react-icons", "radix-ui"],
      message: "Use @base-ui/react for interactive primitives.",
    },
    {
      group: ["framer-motion", "framer-motion/**"],
      message:
        "Use motion/react in client components or motion/react-client in server components.",
    },
  ],
};

export default defineConfig({
  extends: [core, react, vitest],
  jsPlugins: [{ name: "design-system", specifier: "outtrue" }],
  ignorePatterns: [...(core.ignorePatterns ?? [])],
  overrides: [
    {
      files: ["src/**", "tests/**"],
      rules: {
        "design-system/known-tokens": "off",
        "design-system/layout-only-classname": "off",
        "design-system/no-important": "off",
        "design-system/no-inline-style": "off",
        "design-system/no-raw-values": "off",
        "design-system/no-reach-in-selectors": "off",
        "design-system/one-way-imports": "off",
        "design-system/prefer-shorthand": "off",
      },
    },
    {
      files: ["apps/web/postcss.config.js"],
      rules: { "unicorn/prefer-module": "off" },
    },
    {
      files: ["apps/web/**/*.{js,jsx,ts,tsx,mjs,mts}"],
      plugins: ["nextjs"],
      rules: next.rules,
    },
    {
      files: ["**/*.test.ts"],
      plugins: ["vitest"],
      rules: {
        "vitest/max-expects": "off",
        "vitest/padding-around-test-blocks": "off",
        "vitest/prefer-describe-function-title": "off",
        "vitest/prefer-each": "off",
        "vitest/prefer-strict-equal": "off",
        "vitest/prefer-to-be-falsy": "off",
        "vitest/prefer-to-be-truthy": "off",
        "vitest/require-top-level-describe": "off",
      },
    },
    {
      files: ["**/page.{ts,tsx}", "**/layout.{ts,tsx}", "next.config.*"],
      rules: {
        "require-await": "off",
      },
    },
  ],

  rules: {
    "design-system/known-tokens": [
      "error",
      { theme: ["apps/web/src/styles/globals.css"] },
    ],
    "design-system/layout-only-classname": [
      "error",
      {
        allow: [
          "^(?:inline-)?flex$",
          "^flex-(?:row|col)",
          "^gap-",
          "^items-",
          "^justify-",
          "^-?translate-",
        ],
        primitives: ["@/components/copy-button", "@/components/kbd"],
      },
    ],
    "design-system/no-important": "error",
    "design-system/no-inline-style": "error",
    "design-system/no-raw-values": "error",
    "design-system/no-reach-in-selectors": [
      "error",
      { primitives: ["@/components/copy-button", "@/components/kbd"] },
    ],
    "design-system/one-way-imports": [
      "error",
      {
        alias: { "@/": "apps/web/src/" },
        layers: ["apps/web/src/components", "apps/web/src/app"],
      },
    ],
    "design-system/prefer-shorthand": "error",
    complexity: ["error", { max: 20, variant: "modified" }],
    eqeqeq: ["error", "always", { null: "ignore" }],

    "func-style": "off",
    "import/consistent-type-specifier-style": "off",
    "import/first": "error",
    "import/newline-after-import": "off",

    "import/no-named-as-default": "off",

    "jsx-a11y/control-has-associated-label": ["error", { depth: 5 }],

    "jsx-a11y/prefer-tag-over-role": "off",

    "no-await-in-loop": "off",

    "no-eq-null": "off",

    "no-plusplus": "off",
    "no-promise-executor-return": "error",
    "no-restricted-imports": ["error", restrictedImports],
    "no-return-assign": "error",

    "no-unused-vars": ["error", { ignoreRestSiblings: true }],

    "no-use-before-define": [
      "error",
      { classes: false, functions: false, variables: false },
    ],
    "prefer-destructuring": "off",
    "prefer-named-capture-group": "off",
    "promise/always-return": ["error", { ignoreLastCallback: true }],
    "promise/avoid-new": "off",
    "promise/catch-or-return": "error",
    "promise/param-names": "off",
    "promise/prefer-await-to-callbacks": "off",
    "promise/prefer-await-to-then": "off",

    "react/capitalized-calls": "error",
    "react/error-boundaries": "error",
    "react/exhaustive-effect-dependencies": "off",
    "react/function-component-definition": "off",
    "react/globals": "error",
    "react/hook-use-state": "off",
    "react/hooks": "off",
    "react/immutability": "error",
    "react/incompatible-library": "error",
    "react/invariant": "off",
    "react/jsx-curly-brace-presence": "off",
    "react/jsx-handler-names": "off",

    "react/jsx-no-constructed-context-values": "off",
    "react/jsx-no-target-blank": ["error", { allowReferrer: true }],
    "react/jsx-pascal-case": ["error", { allowAllCaps: true }],
    "react/memo-dependencies": "off",
    "react/no-clone-element": "off",
    "react/no-object-type-as-default-prop": "off",
    "react/no-react-children": "off",

    "react/no-unescaped-entities": "off",
    "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
    "react/preserve-manual-memoization": "off",
    "react/purity": "error",
    "react/refs": "error",
    "react/rule-suppression": "off",
    "react/set-state-in-effect": "error",
    "react/set-state-in-render": "error",
    "react/static-components": "error",
    "react/syntax": "off",
    "react/todo": "off",
    "react/unsupported-syntax": "error",
    "react/use-memo": "off",
    "require-unicode-regexp": "off",

    "sort-keys": "off",
    "typescript/array-type": "off",
    "typescript/consistent-type-imports": [
      "error",
      { disallowTypeAnnotations: false },
    ],
    "unicorn/catch-error-name": "off",
    "unicorn/consistent-existence-index-check": "off",
    "unicorn/consistent-function-scoping": "off",
    "unicorn/import-style": "off",
    "unicorn/no-array-for-each": "off",
    "unicorn/no-array-sort": "off",
    "unicorn/no-await-expression-member": "off",
    "unicorn/no-new-array": "off",
    "unicorn/no-object-as-default-parameter": "off",
    "unicorn/no-useless-undefined": "off",
    "unicorn/numeric-separators-style": "off",
    "unicorn/prefer-add-event-listener": "off",
    "unicorn/prefer-export-from": "off",
    "unicorn/prefer-number-coercion": "off",
    "unicorn/prefer-query-selector": "off",
    "unicorn/prefer-spread": "off",
    "unicorn/prefer-string-replace-all": "off",
    "unicorn/prefer-type-error": "off",
    "unicorn/switch-case-braces": "off",
    "unicorn/text-encoding-identifier-case": "off",
  },
});
