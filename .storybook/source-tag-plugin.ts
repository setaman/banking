import path from "node:path";

import { transformAsync, types as t } from "@babel/core";
import type { Plugin } from "vite";

/**
 * Dev-only Vite plugin: adds `data-sb-source="<repo-relative path>:<line>:<col>"`
 * to every intrinsic (lowercase) JSX element under `src/`.
 */
export function sourceTagPlugin(): Plugin {
  const root = process.cwd();
  return {
    name: "sb-source-tag",
    enforce: "pre",
    apply: "serve",
    async transform(code, id) {
      const file = id.split("?")[0];
      if (!/\.[jt]sx$/.test(file) || file.includes("node_modules")) return null;
      const rel = path.relative(root, file).split(path.sep).join("/");
      if (!rel.startsWith("src/") || rel.includes(".stories.")) return null;

      const result = await transformAsync(code, {
        filename: file,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        retainLines: true,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [
          () => ({
            visitor: {
              JSXOpeningElement(p) {
                const name = p.node.name;
                const forwards =
                  (name.type === "JSXIdentifier" &&
                    (/^[a-z]/.test(name.name) || name.name === "Comp" || name.name === "Slot")) ||
                  (name.type === "JSXMemberExpression" &&
                    name.object.type === "JSXIdentifier" &&
                    name.object.name.endsWith("Primitive"));
                if (!forwards) return;
                const has = p.node.attributes.some(
                  (a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === "data-sb-source"
                );
                if (has || !p.node.loc) return;
                const { line, column } = p.node.loc.start;
                p.node.attributes.push(
                  t.jsxAttribute(
                    t.jsxIdentifier("data-sb-source"),
                    t.stringLiteral(`${rel}:${line}:${column + 1}`)
                  )
                );
              },
            },
          }),
        ],
      });
      if (!result?.code) return null;
      return { code: result.code, map: result.map };
    },
  };
}
