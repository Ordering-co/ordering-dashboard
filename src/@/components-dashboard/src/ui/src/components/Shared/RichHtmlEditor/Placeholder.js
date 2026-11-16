import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Shows the placeholder on the first paragraph while the whole document is empty.
export const Placeholder = Extension.create({
  name: 'placeholder',
  addOptions () {
    return { placeholder: '' }
  },
  addProseMirrorPlugins () {
    const { placeholder } = this.options
    return [
      new Plugin({
        props: {
          decorations: ({ doc }) => {
            const first = doc.firstChild
            if (!placeholder || doc.childCount !== 1 || !first.isTextblock || first.content.size) return null
            return DecorationSet.create(doc, [Decoration.node(0, first.nodeSize, { class: 'is-editor-empty', 'data-placeholder': placeholder })])
          }
        }
      })
    ]
  }
})
