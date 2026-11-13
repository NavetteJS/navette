// Built-in rich editor tools, as defined by Filament's RichEditor (generated from its source: do not edit by hand).
import type { RichEditorToolDefinition } from './rich-editor-tool.ts';

export const RICH_EDITOR_TOOL_DEFINITIONS: RichEditorToolDefinition[] = [
    {
        "name": "bold",
        "label": "filament-forms::components.rich_editor.tools.bold",
        "jsHandler": "$getEditor()?.chain().focus().toggleBold().run()",
        "toggle": true,
        "icon": "m-bold"
    },
    {
        "name": "italic",
        "label": "filament-forms::components.rich_editor.tools.italic",
        "jsHandler": "$getEditor()?.chain().focus().toggleItalic().run()",
        "toggle": true,
        "icon": "m-italic"
    },
    {
        "name": "underline",
        "label": "filament-forms::components.rich_editor.tools.underline",
        "jsHandler": "$getEditor()?.chain().focus().toggleUnderline().run()",
        "toggle": true,
        "icon": "m-underline"
    },
    {
        "name": "strike",
        "label": "filament-forms::components.rich_editor.tools.strike",
        "jsHandler": "$getEditor()?.chain().focus().toggleStrike().run()",
        "toggle": true,
        "icon": "m-strikethrough"
    },
    {
        "name": "subscript",
        "label": "filament-forms::components.rich_editor.tools.subscript",
        "jsHandler": "$getEditor()?.chain().focus().toggleSubscript().run()",
        "toggle": true,
        "icon": "fi-o-subscript"
    },
    {
        "name": "superscript",
        "label": "filament-forms::components.rich_editor.tools.superscript",
        "jsHandler": "$getEditor()?.chain().focus().toggleSuperscript().run()",
        "toggle": true,
        "icon": "fi-o-superscript"
    },
    {
        "name": "link",
        "label": "filament-forms::components.rich_editor.tools.link",
        "action": "{ url: $getEditor().getAttributes('link')?.href, shouldOpenInNewTab: $getEditor().getAttributes('link')?.target === '_blank' }",
        "toggle": true,
        "icon": "m-link"
    },
    {
        "name": "textColor",
        "label": "filament-forms::components.rich_editor.tools.text_color",
        "action": "{ color: $getEditor().getAttributes('textColor')['data-color'] ?? null }",
        "toggle": true,
        "icon": "m-swatch"
    },
    {
        "name": "h1",
        "label": "filament-forms::components.rich_editor.tools.h1",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 1 }).run()",
        "toggle": true,
        "icon": "fi-o-h1",
        "activeKey": "heading",
        "activeOptions": {
            "level": 1
        }
    },
    {
        "name": "h2",
        "label": "filament-forms::components.rich_editor.tools.h2",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 2 }).run()",
        "toggle": true,
        "icon": "fi-o-h2",
        "activeKey": "heading",
        "activeOptions": {
            "level": 2
        }
    },
    {
        "name": "h3",
        "label": "filament-forms::components.rich_editor.tools.h3",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 3 }).run()",
        "toggle": true,
        "icon": "fi-o-h3",
        "activeKey": "heading",
        "activeOptions": {
            "level": 3
        }
    },
    {
        "name": "paragraph",
        "label": "filament-forms::components.rich_editor.tools.paragraph",
        "jsHandler": "$getEditor()?.chain().focus().setParagraph().run()",
        "toggle": true,
        "icon": "fi-o-paragraph"
    },
    {
        "name": "h4",
        "label": "filament-forms::components.rich_editor.tools.h4",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 4 }).run()",
        "toggle": true,
        "icon": "fi-o-h4",
        "activeKey": "heading",
        "activeOptions": {
            "level": 4
        }
    },
    {
        "name": "h5",
        "label": "filament-forms::components.rich_editor.tools.h5",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 5 }).run()",
        "toggle": true,
        "icon": "fi-o-h5",
        "activeKey": "heading",
        "activeOptions": {
            "level": 5
        }
    },
    {
        "name": "h6",
        "label": "filament-forms::components.rich_editor.tools.h6",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 6 }).run()",
        "toggle": true,
        "icon": "fi-o-h6",
        "activeKey": "heading",
        "activeOptions": {
            "level": 6
        }
    },
    {
        "name": "blockquote",
        "label": "filament-forms::components.rich_editor.tools.blockquote",
        "jsHandler": "$getEditor()?.chain().focus().toggleBlockquote().run()",
        "toggle": true,
        "icon": "m-chat-bubble-bottom-center-text"
    },
    {
        "name": "code",
        "label": "filament-forms::components.rich_editor.tools.code",
        "jsHandler": "$getEditor()?.chain().focus().toggleCode().run()",
        "toggle": true,
        "icon": "fi-o-code"
    },
    {
        "name": "codeBlock",
        "label": "filament-forms::components.rich_editor.tools.code_block",
        "jsHandler": "$getEditor()?.chain().focus().toggleCodeBlock().run()",
        "toggle": true,
        "icon": "fi-o-code-block"
    },
    {
        "name": "bulletList",
        "label": "filament-forms::components.rich_editor.tools.bullet_list",
        "jsHandler": "$getEditor()?.chain().focus().toggleBulletList().run()",
        "toggle": true,
        "icon": "m-list-bullet"
    },
    {
        "name": "orderedList",
        "label": "filament-forms::components.rich_editor.tools.ordered_list",
        "jsHandler": "$getEditor()?.chain().focus().toggleOrderedList().run()",
        "toggle": true,
        "icon": "m-numbered-list"
    },
    {
        "name": "table",
        "label": "filament-forms::components.rich_editor.tools.table",
        "jsHandler": "$getEditor()?.commands.insertTable({ rows: 2, cols: 3, withHeaderRow: true })",
        "icon": "fi-o-table"
    },
    {
        "name": "tableAddColumnBefore",
        "label": "filament-forms::components.rich_editor.tools.table_add_column_before",
        "jsHandler": "$getEditor()?.chain().focus().addColumnBefore().run()",
        "icon": "fi-o-table-add-column-before"
    },
    {
        "name": "tableAddColumnAfter",
        "label": "filament-forms::components.rich_editor.tools.table_add_column_after",
        "jsHandler": "$getEditor()?.chain().focus().addColumnAfter().run()",
        "icon": "fi-o-table-add-column-after"
    },
    {
        "name": "tableDeleteColumn",
        "label": "filament-forms::components.rich_editor.tools.table_delete_column",
        "jsHandler": "$getEditor()?.chain().focus().deleteColumn().run()",
        "icon": "fi-o-table-delete-column"
    },
    {
        "name": "tableAddRowBefore",
        "label": "filament-forms::components.rich_editor.tools.table_add_row_before",
        "jsHandler": "$getEditor()?.chain().focus().addRowBefore().run()",
        "icon": "fi-o-table-add-row-before"
    },
    {
        "name": "tableAddRowAfter",
        "label": "filament-forms::components.rich_editor.tools.table_add_row_after",
        "jsHandler": "$getEditor()?.chain().focus().addRowAfter().run()",
        "icon": "fi-o-table-add-row-after"
    },
    {
        "name": "tableDeleteRow",
        "label": "filament-forms::components.rich_editor.tools.table_delete_row",
        "jsHandler": "$getEditor()?.chain().focus().deleteRow().run()",
        "icon": "fi-o-table-delete-row"
    },
    {
        "name": "tableMergeCells",
        "label": "filament-forms::components.rich_editor.tools.table_merge_cells",
        "jsHandler": "$getEditor()?.chain().focus().mergeCells().run()",
        "icon": "fi-o-table-merge-cells"
    },
    {
        "name": "tableSplitCell",
        "label": "filament-forms::components.rich_editor.tools.table_split_cell",
        "jsHandler": "$getEditor()?.chain().focus().splitCell().run()",
        "icon": "fi-o-table-split-cell"
    },
    {
        "name": "tableToggleHeaderRow",
        "label": "filament-forms::components.rich_editor.tools.table_toggle_header_row",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeaderRow().run()",
        "icon": "fi-o-table-toggle-header-row"
    },
    {
        "name": "tableToggleHeaderCell",
        "label": "filament-forms::components.rich_editor.tools.table_toggle_header_cell",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeaderCell().run()",
        "icon": "fi-o-table-toggle-header-cell"
    },
    {
        "name": "tableDelete",
        "label": "filament-forms::components.rich_editor.tools.table_delete",
        "jsHandler": "$getEditor()?.chain().focus().deleteTable().run()",
        "icon": "fi-o-table-delete"
    },
    {
        "name": "attachFiles",
        "label": "filament-forms::components.rich_editor.tools.attach_files",
        "action": "{ alt: $getEditor().getAttributes('image')?.alt, id: $getEditor().getAttributes('image')?.id, src: $getEditor().getAttributes('image')?.src }",
        "icon": "m-paper-clip",
        "activeKey": "image"
    },
    {
        "name": "customBlocks",
        "label": "filament-forms::components.rich_editor.tools.custom_blocks",
        "jsHandler": "togglePanel('customBlocks')",
        "icon": "m-squares-plus",
        "activeJsExpression": "isPanelActive('customBlocks')"
    },
    {
        "name": "mergeTags",
        "label": "filament-forms::components.rich_editor.tools.merge_tags",
        "jsHandler": "togglePanel('mergeTags')",
        "icon": "fi-o-merge-tag",
        "activeJsExpression": "isPanelActive('mergeTags')"
    },
    {
        "name": "horizontalRule",
        "label": "filament-forms::components.rich_editor.tools.horizontal_rule",
        "jsHandler": "$getEditor()?.chain().focus().setHorizontalRule().run()",
        "icon": "m-minus"
    },
    {
        "name": "highlight",
        "label": "filament-forms::components.rich_editor.tools.highlight",
        "jsHandler": "$getEditor()?.chain().focus().toggleHighlight().run()",
        "toggle": true,
        "icon": "fi-o-highlight"
    },
    {
        "name": "small",
        "label": "filament-forms::components.rich_editor.tools.small",
        "jsHandler": "$getEditor()?.chain().focus().toggleSmall().run()",
        "toggle": true,
        "icon": "fi-o-small"
    },
    {
        "name": "lead",
        "label": "filament-forms::components.rich_editor.tools.lead",
        "jsHandler": "$getEditor()?.chain().focus().toggleLead().run()",
        "toggle": true,
        "icon": "fi-o-lead"
    },
    {
        "name": "undo",
        "label": "filament-forms::components.rich_editor.tools.undo",
        "jsHandler": "$getEditor()?.chain().focus().undo().run()",
        "icon": "m-arrow-uturn-left"
    },
    {
        "name": "redo",
        "label": "filament-forms::components.rich_editor.tools.redo",
        "jsHandler": "$getEditor()?.chain().focus().redo().run()",
        "icon": "m-arrow-uturn-right"
    },
    {
        "name": "alignStart",
        "label": "filament-forms::components.rich_editor.tools.align_start",
        "jsHandler": "$getEditor()?.chain().focus().setTextAlign('start').run()",
        "toggle": true,
        "icon": "fi-o-align-start",
        "activeJsExpression": "$getEditor()?.isActive({ textAlign: 'start' })"
    },
    {
        "name": "alignCenter",
        "label": "filament-forms::components.rich_editor.tools.align_center",
        "jsHandler": "$getEditor()?.chain().focus().setTextAlign('center').run()",
        "toggle": true,
        "icon": "fi-o-align-center",
        "activeJsExpression": "$getEditor()?.isActive({ textAlign: 'center' })"
    },
    {
        "name": "alignEnd",
        "label": "filament-forms::components.rich_editor.tools.align_end",
        "jsHandler": "$getEditor()?.chain().focus().setTextAlign('end').run()",
        "toggle": true,
        "icon": "fi-o-align-end",
        "activeJsExpression": "$getEditor()?.isActive({ textAlign: 'end' })"
    },
    {
        "name": "alignJustify",
        "label": "filament-forms::components.rich_editor.tools.align_justify",
        "jsHandler": "$getEditor()?.chain().focus().setTextAlign('justify').run()",
        "toggle": true,
        "icon": "fi-o-align-justify",
        "activeJsExpression": "$getEditor()?.isActive({ textAlign: 'justify' })"
    },
    {
        "name": "grid",
        "label": "filament-forms::components.rich_editor.tools.grid",
        "action": "{}",
        "icon": "fi-o-columns",
        "activeJsExpression": "false"
    },
    {
        "name": "gridAddColumnBefore",
        "label": "filament-forms::components.rich_editor.tools.table_add_column_before",
        "jsHandler": "$getEditor()?.chain().focus().addGridColumnBefore().run()",
        "icon": "fi-o-table-add-column-before",
        "activeJsExpression": "$getEditor()?.can().addGridColumnBefore()",
        "activeStyling": false,
        "disabledWhenNotActive": true,
        "extraAttributes": {
            "data-testid": "grid-add-column-before"
        }
    },
    {
        "name": "gridAddColumnAfter",
        "label": "filament-forms::components.rich_editor.tools.table_add_column_after",
        "jsHandler": "$getEditor()?.chain().focus().addGridColumnAfter().run()",
        "icon": "fi-o-table-add-column-after",
        "activeJsExpression": "$getEditor()?.can().addGridColumnAfter()",
        "activeStyling": false,
        "disabledWhenNotActive": true,
        "extraAttributes": {
            "data-testid": "grid-add-column-after"
        }
    },
    {
        "name": "gridDeleteColumn",
        "label": "filament-forms::components.rich_editor.tools.table_delete_column",
        "jsHandler": "$getEditor()?.chain().focus().deleteGridColumn().run()",
        "icon": "fi-o-table-delete-column",
        "activeJsExpression": "$getEditor()?.can().deleteGridColumn()",
        "activeStyling": false,
        "disabledWhenNotActive": true,
        "extraAttributes": {
            "data-testid": "grid-delete-column"
        }
    },
    {
        "name": "gridDelete",
        "label": "filament-forms::components.rich_editor.tools.grid_delete",
        "jsHandler": "$getEditor()?.chain().focus().deleteGrid().run()",
        "icon": "fi-o-columns-delete",
        "activeKey": "grid",
        "activeStyling": false,
        "disabledWhenNotActive": true
    },
    {
        "name": "details",
        "label": "filament-forms::components.rich_editor.tools.details",
        "jsHandler": "$getEditor()?.chain().focus().setDetails().run()",
        "icon": "fi-o-details"
    },
    {
        "name": "clearFormatting",
        "label": "filament-forms::components.rich_editor.tools.clear_formatting",
        "jsHandler": "$getEditor()?.chain().focus().clearNodes().unsetAllMarks().run()",
        "icon": "fi-o-clear-formatting"
    }
];
