import { createHash } from "node:crypto";
import path from "node:path";
import type { Root, RootContent } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import type { VFile } from "vfile";
import { blockType } from "./shared/markdown";

export function hashSource(source: string): string {
  return createHash("sha1").update(source).digest("hex").slice(0, 10);
}

const attribute = (name: string, value: string): MdxJsxAttribute => ({
  type: "mdxJsxAttribute",
  name,
  value,
});

// A plain style string would reach React as a string and throw, so the
// object literal is spelled out as the estree MDX expects for `style={{…}}`.
const displayContents: MdxJsxAttribute = {
  type: "mdxJsxAttribute",
  name: "style",
  value: {
    type: "mdxJsxAttributeValueExpression",
    value: '{display:"contents"}',
    data: {
      estree: {
        type: "Program",
        sourceType: "module",
        body: [
          {
            type: "ExpressionStatement",
            expression: {
              type: "ObjectExpression",
              properties: [
                {
                  type: "Property",
                  kind: "init",
                  method: false,
                  shorthand: false,
                  computed: false,
                  key: { type: "Identifier", name: "display" },
                  value: { type: "Literal", value: "contents", raw: '"contents"' },
                },
              ],
            },
          },
        ],
      },
    },
  },
};

/** Wraps every top-level block in a `display: contents` div that records where it came from. */
export default function remarkEsqe() {
  return (tree: Root, file: VFile) => {
    if (!file.path) return;
    const source = String(file.value);
    const relative = path.relative(process.cwd(), file.path).split(path.sep).join("/");
    const version = hashSource(source);

    tree.children = tree.children.map((node): RootContent => {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined || node.type === "mdxjsEsm") return node;

      const wrapper: MdxJsxFlowElement = {
        type: "mdxJsxFlowElement",
        name: "div",
        attributes: [
          attribute("data-esqe-file", relative),
          attribute("data-esqe-start", String(start)),
          attribute("data-esqe-end", String(end)),
          attribute("data-esqe-type", blockType(node)),
          attribute("data-esqe-v", version),
          displayContents,
        ],
        children: [node as MdxJsxFlowElement["children"][number]],
      };
      return wrapper;
    });
  };
}
