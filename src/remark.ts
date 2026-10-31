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
  name,
  type: "mdxJsxAttribute",
  value,
});

// A plain style string would reach React as a string and throw, so the
// object literal is spelled out as the estree MDX expects for `style={{…}}`.
const displayContents: MdxJsxAttribute = {
  name: "style",
  type: "mdxJsxAttribute",
  value: {
    data: {
      estree: {
        body: [
          {
            expression: {
              properties: [
                {
                  computed: false,
                  key: { name: "display", type: "Identifier" },
                  kind: "init",
                  method: false,
                  shorthand: false,
                  type: "Property",
                  value: {
                    raw: '"contents"',
                    type: "Literal",
                    value: "contents",
                  },
                },
              ],
              type: "ObjectExpression",
            },
            type: "ExpressionStatement",
          },
        ],
        sourceType: "module",
        type: "Program",
      },
    },
    type: "mdxJsxAttributeValueExpression",
    value: '{display:"contents"}',
  },
};

/** Wraps every top-level block in a `display: contents` div that records where it came from. */
export default function remarkEsqia() {
  return (tree: Root, file: VFile) => {
    if (!file.path) {
      return;
    }
    const source = String(file.value);
    const relative = path
      .relative(process.cwd(), file.path)
      .split(path.sep)
      .join("/");
    const version = hashSource(source);

    tree.children = tree.children.map((node): RootContent => {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (
        start === undefined ||
        end === undefined ||
        node.type === "mdxjsEsm"
      ) {
        return node;
      }

      const wrapper: MdxJsxFlowElement = {
        attributes: [
          attribute("data-esqia-file", relative),
          attribute("data-esqia-start", String(start)),
          attribute("data-esqia-end", String(end)),
          attribute("data-esqia-type", blockType(node)),
          attribute("data-esqia-v", version),
          displayContents,
        ],
        children: [node as MdxJsxFlowElement["children"][number]],
        name: "div",
        type: "mdxJsxFlowElement",
      };
      return wrapper;
    });
  };
}
