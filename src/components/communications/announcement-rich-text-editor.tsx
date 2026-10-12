'use client'

import * as React from 'react'
import {
  EditorContent,
  ReactRenderer,
  useEditor,
  type Editor,
  type JSONContent,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import { useTranslations } from 'next-intl'
import type { TargetOption } from '@/components/communications/target-fields'
import { cn } from '@/lib/utils'

export type AnnouncementEditorMention = {
  id: string
  label: string
}

export type AnnouncementRichTextEditorHandle = {
  insertEmoji: (emoji: string) => void
  openMention: () => void
  focus: () => void
}

type AnnouncementRichTextEditorProps = {
  id?: string
  value: string
  mentions: AnnouncementEditorMention[]
  mentionOptions: TargetOption[]
  onChange: (body: string, mentions: AnnouncementEditorMention[]) => void
  className?: string
}

type MentionSuggestionItem = {
  id: string
  label: string
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function textNode(text: string): JSONContent | null {
  return text ? { type: 'text', text } : null
}

function paragraphFromLine(line: string, mentions: AnnouncementEditorMention[]): JSONContent {
  const sortedMentions = mentions
    .filter((mention) => mention.label)
    .sort((a, b) => b.label.length - a.label.length)
  if (sortedMentions.length === 0) {
    const node = textNode(line)
    return { type: 'paragraph', content: node ? [node] : undefined }
  }

  const regex = new RegExp(
    `@(?:${sortedMentions.map((mention) => escapeRegExp(mention.label)).join('|')})(?=\\s|$)`,
    'g',
  )
  const content: JSONContent[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(line)) !== null) {
    const before = textNode(line.slice(lastIndex, match.index))
    if (before) content.push(before)

    const label = match[0].slice(1)
    const mention = sortedMentions.find((item) => item.label === label)
    if (mention) {
      content.push({
        type: 'mention',
        attrs: {
          id: mention.id,
          label: mention.label,
        },
      })
    } else {
      const fallback = textNode(match[0])
      if (fallback) content.push(fallback)
    }

    lastIndex = match.index + match[0].length
  }

  const after = textNode(line.slice(lastIndex))
  if (after) content.push(after)

  return { type: 'paragraph', content: content.length > 0 ? content : undefined }
}

function buildEditorContent(value: string, mentions: AnnouncementEditorMention[]): JSONContent {
  const lines = value.split('\n')
  return {
    type: 'doc',
    content: lines.map((line) => paragraphFromLine(line, mentions)),
  }
}

function extractMentions(editor: Editor): AnnouncementEditorMention[] {
  const mentions: AnnouncementEditorMention[] = []
  const seen = new Set<string>()

  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'mention') return
    const id = String(node.attrs.id || '')
    const label = String(node.attrs.label || id)
    if (!id || seen.has(id)) return
    seen.add(id)
    mentions.push({ id, label })
  })

  return mentions
}

function MentionList({
  items,
  command,
  selectedIndex,
  emptyMessage,
}: {
  items: MentionSuggestionItem[]
  command: (item: MentionSuggestionItem) => void
  selectedIndex: number
  emptyMessage: string
}) {
  if (items.length === 0) {
    return <div className="px-2 py-1.5 text-sm text-muted-foreground">{emptyMessage}</div>
  }

  return (
    <div className="max-h-56 w-72 overflow-auto rounded-md border bg-popover p-1 shadow-lg">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            command(item)
          }}
          className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
            index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
          }`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
            {item.label
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </span>
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  )
}

const MentionListWithRef = React.forwardRef<
  { onKeyDown: (props: SuggestionKeyDownProps) => boolean },
  {
    items: MentionSuggestionItem[]
    command: (item: MentionSuggestionItem) => void
    emptyMessage: string
  }
>(function MentionListWithRef(props, ref) {
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  React.useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  React.useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((index) => (index + props.items.length - 1) % props.items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((index) => (index + 1) % props.items.length)
          return true
        }
        if (event.key === 'Enter') {
          const item = props.items[selectedIndex]
          if (item) props.command(item)
          return true
        }
        return false
      },
    }),
    [props, selectedIndex],
  )

  return (
    <MentionList
      items={props.items}
      command={props.command}
      selectedIndex={selectedIndex}
      emptyMessage={props.emptyMessage}
    />
  )
})

function movePopup(element: HTMLElement, props: SuggestionProps<MentionSuggestionItem>) {
  const rect = props.clientRect?.()
  if (!rect) return
  element.style.position = 'fixed'
  element.style.left = `${rect.left}px`
  element.style.top = `${rect.bottom + 6}px`
  element.style.zIndex = '100'
}

export const AnnouncementRichTextEditor = React.forwardRef<
  AnnouncementRichTextEditorHandle,
  AnnouncementRichTextEditorProps
>(function AnnouncementRichTextEditor(
  { id, value, mentions, mentionOptions, onChange, className },
  ref,
) {
  const t = useTranslations('announcements')
  const lastValueRef = React.useRef(value)
  const lastMentionsRef = React.useRef(mentions)
  const noPeopleFound = t('noPeopleFound')

  const mentionExtension = React.useMemo(
    () =>
      Mention.configure({
        HTMLAttributes: {
          class:
            'inline-flex rounded-sm bg-blue-50 px-0.5 font-medium text-blue-600',
        },
        renderText({ node }) {
          return `@${node.attrs.label || node.attrs.id}`
        },
        suggestion: {
          char: '@',
          items: ({ query }) =>
            mentionOptions
              .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
              .map((item) => ({
                id: item.value,
                label: item.label,
              }))
              .slice(0, 8),
          command: ({ editor, range, props }) => {
            const item = props as unknown as MentionSuggestionItem
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: 'mention',
                  attrs: {
                    id: item.id,
                    label: item.label,
                  },
                },
                {
                  type: 'text',
                  text: ' ',
                },
              ])
              .run()
          },
          render: () => {
            let component: ReactRenderer<
              { onKeyDown: (props: SuggestionKeyDownProps) => boolean },
              {
                items: MentionSuggestionItem[]
                command: (item: MentionSuggestionItem) => void
                emptyMessage: string
              }
            > | null = null
            let popup: HTMLDivElement | null = null

            return {
              onStart: (props) => {
                popup = document.createElement('div')
                document.body.appendChild(popup)
                component = new ReactRenderer(MentionListWithRef, {
                  props: {
                    items: props.items,
                    command: (item: MentionSuggestionItem) => props.command(item),
                    emptyMessage: noPeopleFound,
                  },
                  editor: props.editor,
                })
                popup.appendChild(component.element)
                movePopup(popup, props)
              },
              onUpdate: (props) => {
                component?.updateProps({
                  items: props.items,
                  command: (item: MentionSuggestionItem) => props.command(item),
                  emptyMessage: noPeopleFound,
                })
                if (popup) movePopup(popup, props)
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  popup?.remove()
                  return true
                }
                return component?.ref?.onKeyDown(props) ?? false
              },
              onExit: () => {
                popup?.remove()
                component?.destroy()
                popup = null
                component = null
              },
            }
          },
        },
      }),
    [mentionOptions, noPeopleFound],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      mentionExtension,
    ],
    content: buildEditorContent(value, mentions),
    editorProps: {
      attributes: {
        id: id || '',
        class: cn(
          'min-h-36 rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const nextValue = editor.getText({ blockSeparator: '\n' })
      const nextMentions = extractMentions(editor)
      lastValueRef.current = nextValue
      lastMentionsRef.current = nextMentions
      onChange(nextValue, nextMentions)
    },
  })

  React.useEffect(() => {
    if (!editor) return
    const sameValue = value === lastValueRef.current
    const sameMentions =
      mentions.length === lastMentionsRef.current.length &&
      mentions.every((mention, index) => mention.id === lastMentionsRef.current[index]?.id)
    if (sameValue && sameMentions) return

    editor.commands.setContent(buildEditorContent(value, mentions), { emitUpdate: false })
    lastValueRef.current = value
    lastMentionsRef.current = mentions
  }, [editor, mentions, value])

  React.useImperativeHandle(
    ref,
    () => ({
      insertEmoji: (emoji) => {
        editor?.chain().focus().insertContent(emoji).run()
      },
      openMention: () => {
        editor?.chain().focus().insertContent('@').run()
      },
      focus: () => {
        editor?.chain().focus().run()
      },
    }),
    [editor],
  )

  return <EditorContent editor={editor} />
})
