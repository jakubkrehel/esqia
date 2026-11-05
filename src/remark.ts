import path from "node:path";
import type { Root, RootContent } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import type { VFile } from "vfile";
import { hashSource } from "./shared/hash";
import { blockFields, wrapperAttributes } from "./shared/wrapper";

export { hashSource } from "./shared/hash";

const attribute = (name: string, value: string): MdxJsxAttribute => ({
  name,
  type: "mdxJsxAttribute",
  value,
});

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
      const fields = blockFields(node, relative, version);
      if (!fields) {
        return node;
      }

      const wrapper: MdxJsxFlowElement = {
        attributes: [
          ...wrapperAttributes(fields).map(([name, value]) =>
            attribute(name, value)
          ),
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
