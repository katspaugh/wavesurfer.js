type TreeNode = { [key: string]: string | number | boolean | CSSStyleDeclaration | TreeNode | Node } & {
  xmlns?: string
  style?: Partial<CSSStyleDeclaration>
  textContent?: string | Node
  children?: TreeNode
}

function renderNode(tagName: string, content: TreeNode): HTMLElement | SVGElement {
  const element = content.xmlns
    ? (document.createElementNS(content.xmlns, tagName) as SVGElement)
    : (document.createElement(tagName) as HTMLElement)

  for (const [key, value] of Object.entries(content)) {
    if (key === 'children' && value) {
      for (const [childTag, childValue] of Object.entries(value as TreeNode)) {
        if (childValue instanceof Node) {
          element.appendChild(childValue)
        } else if (typeof childValue === 'string') {
          element.appendChild(document.createTextNode(childValue))
        } else {
          element.appendChild(renderNode(childTag, childValue as TreeNode))
        }
      }
    } else if (key === 'style') {
      Object.assign((element as HTMLElement).style, value)
    } else if (key === 'textContent') {
      element.textContent = value as string
    } else {
      element.setAttribute(key, value.toString())
    }
  }

  return element
}

export function createElement(tagName: string, content: TreeNode & { xmlns: string }, container?: Node): SVGElement
export function createElement(tagName: string, content?: TreeNode, container?: Node): HTMLElement
export function createElement(tagName: string, content?: TreeNode, container?: Node): HTMLElement | SVGElement {
  const el = renderNode(tagName, content || {})
  container?.appendChild(el)
  return el
}

export default createElement
