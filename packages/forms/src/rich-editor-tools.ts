// Built-in rich editor tools: name, label key, icon and JavaScript of each toolbar button.
import type { RichEditorToolDefinition } from './rich-editor-tool.ts';

export const RICH_EDITOR_TOOL_DEFINITIONS: RichEditorToolDefinition[] = [
    {
        "name": "bold",
        "label": "navette-forms::components.rich_editor.tools.bold",
        "jsHandler": "$getEditor()?.chain().focus().toggleBold().run()",
        "toggle": true,
        "icon": "m-bold",
        "iconAlias": "forms::components.rich-editor.toolbar.bold"
    },
    {
        "name": "italic",
        "label": "navette-forms::components.rich_editor.tools.italic",
        "jsHandler": "$getEditor()?.chain().focus().toggleItalic().run()",
        "toggle": true,
        "icon": "m-italic",
        "iconAlias": "forms::components.rich-editor.toolbar.italic"
    },
    {
        "name": "underline",
        "label": "navette-forms::components.rich_editor.tools.underline",
        "jsHandler": "$getEditor()?.chain().focus().toggleUnderline().run()",
        "toggle": true,
        "icon": "m-underline",
        "iconAlias": "forms::components.rich-editor.toolbar.underline"
    },
    {
        "name": "strike",
        "label": "navette-forms::components.rich_editor.tools.strike",
        "jsHandler": "$getEditor()?.chain().focus().toggleStrike().run()",
        "toggle": true,
        "icon": "m-strikethrough",
        "iconAlias": "forms::components.rich-editor.toolbar.strike"
    },
    {
        "name": "subscript",
        "label": "navette-forms::components.rich_editor.tools.subscript",
        "jsHandler": "$getEditor()?.chain().focus().toggleSubscript().run()",
        "toggle": true,
        "icon": "nv-o-subscript",
        "iconAlias": "forms::components.rich-editor.toolbar.subscript"
    },
    {
        "name": "superscript",
        "label": "navette-forms::components.rich_editor.tools.superscript",
        "jsHandler": "$getEditor()?.chain().focus().toggleSuperscript().run()",
        "toggle": true,
        "icon": "nv-o-superscript",
        "iconAlias": "forms::components.rich-editor.toolbar.superscript"
    },
    {
        "name": "link",
        "label": "navette-forms::components.rich_editor.tools.link",
        "action": "{ url: $getEditor().getAttributes('link')?.href, shouldOpenInNewTab: $getEditor().getAttributes('link')?.target === '_blank' }",
        "toggle": true,
        "icon": "m-link",
        "iconAlias": "forms::components.rich-editor.toolbar.link"
    },
    {
        "name": "textColor",
        "label": "navette-forms::components.rich_editor.tools.text_color",
        "action": "{ color: $getEditor().getAttributes('textColor')['data-color'] ?? null }",
        "toggle": true,
        "icon": "m-swatch",
        "iconAlias": "forms::components.rich-editor.toolbar.text-color"
    },
    {
        "name": "h1",
        "label": "navette-forms::components.rich_editor.tools.h1",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 1 }).run()",
        "toggle": true,
        "icon": "nv-o-h1",
        "activeKey": "heading",
        "activeOptions": {
            "level": 1
        },
        "iconAlias": "forms::components.rich-editor.toolbar.h1"
    },
    {
        "name": "h2",
        "label": "navette-forms::components.rich_editor.tools.h2",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 2 }).run()",
        "toggle": true,
        "icon": "nv-o-h2",
        "activeKey": "heading",
        "activeOptions": {
            "level": 2
        },
        "iconAlias": "forms::components.rich-editor.toolbar.h2"
    },
    {
        "name": "h3",
        "label": "navette-forms::components.rich_editor.tools.h3",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 3 }).run()",
        "toggle": true,
        "icon": "nv-o-h3",
        "activeKey": "heading",
        "activeOptions": {
            "level": 3
        },
        "iconAlias": "forms::components.rich-editor.toolbar.h3"
    },
    {
        "name": "paragraph",
        "label": "navette-forms::components.rich_editor.tools.paragraph",
        "jsHandler": "$getEditor()?.chain().focus().setParagraph().run()",
        "toggle": true,
        "icon": "nv-o-paragraph",
        "iconAlias": "forms::components.rich-editor.toolbar.paragraph"
    },
    {
        "name": "h4",
        "label": "navette-forms::components.rich_editor.tools.h4",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 4 }).run()",
        "toggle": true,
        "icon": "nv-o-h4",
        "activeKey": "heading",
        "activeOptions": {
            "level": 4
        },
        "iconAlias": "forms::components.rich-editor.toolbar.h4"
    },
    {
        "name": "h5",
        "label": "navette-forms::components.rich_editor.tools.h5",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 5 }).run()",
        "toggle": true,
        "icon": "nv-o-h5",
        "activeKey": "heading",
        "activeOptions": {
            "level": 5
        },
        "iconAlias": "forms::components.rich-editor.toolbar.h5"
    },
    {
        "name": "h6",
        "label": "navette-forms::components.rich_editor.tools.h6",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeading({ level: 6 }).run()",
        "toggle": true,
        "icon": "nv-o-h6",
        "activeKey": "heading",
        "activeOptions": {
            "level": 6
        },
        "iconAlias": "forms::components.rich-editor.toolbar.h6"
    },
    {
        "name": "blockquote",
        "label": "navette-forms::components.rich_editor.tools.blockquote",
        "jsHandler": "$getEditor()?.chain().focus().toggleBlockquote().run()",
        "toggle": true,
        "icon": "m-chat-bubble-bottom-center-text",
        "iconAlias": "forms::components.rich-editor.toolbar.blockquote"
    },
    {
        "name": "code",
        "label": "navette-forms::components.rich_editor.tools.code",
        "jsHandler": "$getEditor()?.chain().focus().toggleCode().run()",
        "toggle": true,
        "icon": "nv-o-code",
        "iconAlias": "forms::components.rich-editor.toolbar.code"
    },
    {
        "name": "codeBlock",
        "label": "navette-forms::components.rich_editor.tools.code_block",
        "jsHandler": "$getEditor()?.chain().focus().toggleCodeBlock().run()",
        "toggle": true,
        "icon": "nv-o-code-block",
        "iconAlias": "forms::components.rich-editor.toolbar.code-block"
    },
    {
        "name": "bulletList",
        "label": "navette-forms::components.rich_editor.tools.bullet_list",
        "jsHandler": "$getEditor()?.chain().focus().toggleBulletList().run()",
        "toggle": true,
        "icon": "m-list-bullet",
        "iconAlias": "forms::components.rich-editor.toolbar.bullet-list"
    },
    {
        "name": "orderedList",
        "label": "navette-forms::components.rich_editor.tools.ordered_list",
        "jsHandler": "$getEditor()?.chain().focus().toggleOrderedList().run()",
        "toggle": true,
        "icon": "m-numbered-list",
        "iconAlias": "forms::components.rich-editor.toolbar.ordered-list"
    },
    {
        "name": "table",
        "label": "navette-forms::components.rich_editor.tools.table",
        "jsHandler": "$getEditor()?.commands.insertTable({ rows: 2, cols: 3, withHeaderRow: true })",
        "icon": "nv-o-table",
        "iconAlias": "forms::components.rich-editor.toolbar.table"
    },
    {
        "name": "tableAddColumnBefore",
        "label": "navette-forms::components.rich_editor.tools.table_add_column_before",
        "jsHandler": "$getEditor()?.chain().focus().addColumnBefore().run()",
        "icon": "nv-o-table-add-column-before",
        "iconAlias": "forms::components.rich-editor.toolbar.table-add-column-before"
    },
    {
        "name": "tableAddColumnAfter",
        "label": "navette-forms::components.rich_editor.tools.table_add_column_after",
        "jsHandler": "$getEditor()?.chain().focus().addColumnAfter().run()",
        "icon": "nv-o-table-add-column-after",
        "iconAlias": "forms::components.rich-editor.toolbar.table-add-column-after"
    },
    {
        "name": "tableDeleteColumn",
        "label": "navette-forms::components.rich_editor.tools.table_delete_column",
        "jsHandler": "$getEditor()?.chain().focus().deleteColumn().run()",
        "icon": "nv-o-table-delete-column",
        "iconAlias": "forms::components.rich-editor.toolbar.table-delete-column"
    },
    {
        "name": "tableAddRowBefore",
        "label": "navette-forms::components.rich_editor.tools.table_add_row_before",
        "jsHandler": "$getEditor()?.chain().focus().addRowBefore().run()",
        "icon": "nv-o-table-add-row-before",
        "iconAlias": "forms::components.rich-editor.toolbar.table-add-row-before"
    },
    {
        "name": "tableAddRowAfter",
        "label": "navette-forms::components.rich_editor.tools.table_add_row_after",
        "jsHandler": "$getEditor()?.chain().focus().addRowAfter().run()",
        "icon": "nv-o-table-add-row-after",
        "iconAlias": "forms::components.rich-editor.toolbar.table-add-row-after"
    },
    {
        "name": "tableDeleteRow",
        "label": "navette-forms::components.rich_editor.tools.table_delete_row",
        "jsHandler": "$getEditor()?.chain().focus().deleteRow().run()",
        "icon": "nv-o-table-delete-row",
        "iconAlias": "forms::components.rich-editor.toolbar.table-delete-row"
    },
    {
        "name": "tableMergeCells",
        "label": "navette-forms::components.rich_editor.tools.table_merge_cells",
        "jsHandler": "$getEditor()?.chain().focus().mergeCells().run()",
        "icon": "nv-o-table-merge-cells",
        "iconAlias": "forms::components.rich-editor.toolbar.table-merge-cells"
    },
    {
        "name": "tableSplitCell",
        "label": "navette-forms::components.rich_editor.tools.table_split_cell",
        "jsHandler": "$getEditor()?.chain().focus().splitCell().run()",
        "icon": "nv-o-table-split-cell",
        "iconAlias": "forms::components.rich-editor.toolbar.table-split-cell"
    },
    {
        "name": "tableToggleHeaderRow",
        "label": "navette-forms::components.rich_editor.tools.table_toggle_header_row",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeaderRow().run()",
        "icon": "nv-o-table-toggle-header-row",
        "iconAlias": "forms::components.rich-editor.toolbar.table-toggle-header-row"
    },
    {
        "name": "tableToggleHeaderCell",
        "label": "navette-forms::components.rich_editor.tools.table_toggle_header_cell",
        "jsHandler": "$getEditor()?.chain().focus().toggleHeaderCell().run()",
        "icon": "nv-o-table-toggle-header-cell",
        "iconAlias": "forms::components.rich-editor.toolbar.table-toggle-header-cell"
    },
    {
        "name": "tableDelete",
        "label": "navette-forms::components.rich_editor.tools.table_delete",
        "jsHandler": "$getEditor()?.chain().focus().deleteTable().run()",
        "icon": "nv-o-table-delete",
        "iconAlias": "forms::components.rich-editor.toolbar.table-delete"
    },
    {
        "name": "attachFiles",
        "label": "navette-forms::components.rich_editor.tools.attach_files",
        "action": "{ alt: $getEditor().getAttributes('image')?.alt, id: $getEditor().getAttributes('image')?.id, src: $getEditor().getAttributes('image')?.src }",
        "icon": "m-paper-clip",
        "activeKey": "image",
        "iconAlias": "forms::components.rich-editor.toolbar.attach-files"
    },
    {
        "name": "customBlocks",
        "label": "navette-forms::components.rich_editor.tools.custom_blocks",
        "jsHandler": "togglePanel('customBlocks')",
        "icon": "m-squares-plus",
        "activeJsExpression": "isPanelActive('customBlocks')",
        "iconAlias": "forms::components.rich-editor.toolbar.custom-blocks"
    },
    {
        "name": "mergeTags",
        "label": "navette-forms::components.rich_editor.tools.merge_tags",
        "jsHandler": "togglePanel('mergeTags')",
        "icon": "nv-o-merge-tag",
        "activeJsExpression": "isPanelActive('mergeTags')",
        "iconAlias": "forms::components.rich-editor.toolbar.merge-tags"
    },
    {
        "name": "horizontalRule",
        "label": "navette-forms::components.rich_editor.tools.horizontal_rule",
        "jsHandler": "$getEditor()?.chain().focus().setHorizontalRule().run()",
        "icon": "m-minus",
        "iconAlias": "forms::components.rich-editor.toolbar.horizontal-rule"
    },
    {
        "name": "highlight",
        "label": "navette-forms::components.rich_editor.tools.highlight",
        "jsHandler": "$getEditor()?.chain().focus().toggleHighlight().run()",
        "toggle": true,
        "icon": "nv-o-highlight",
        "iconAlias": "forms::components.rich-editor.toolbar.highlight"
    },
    {
        "name": "small",
        "label": "navette-forms::components.rich_editor.tools.small",
        "jsHandler": "$getEditor()?.chain().focus().toggleSmall().run()",
        "toggle": true,
        "icon": "nv-o-small",
        "iconAlias": "forms::components.rich-editor.toolbar.small"
    },
    {
        "name": "lead",
        "label": "navette-forms::components.rich_editor.tools.lead",
        "jsHandler": "$getEditor()?.chain().focus().toggleLead().run()",
        "toggle": true,
        "icon": "nv-o-lead",
        "iconAlias": "forms::components.rich-editor.toolbar.lead"
    },
    {
        "name": "undo",
        "label": "navette-forms::components.rich_editor.tools.undo",
        "jsHandler": "$getEditor()?.chain().focus().undo().run()",
        "icon": "m-arrow-uturn-left",
        "iconAlias": "forms::components.rich-editor.toolbar.undo"
    },
    {
        "name": "redo",
        "label": "navette-forms::components.rich_editor.tools.redo",
        "jsHandler": "$getEditor()?.chain().focus().redo().run()",
        "icon": "m-arrow-uturn-right",
        "iconAlias": "forms::components.rich-editor.toolbar.redo"
    },
    {
        "name": "alignStart",
        "label": "navette-forms::components.rich_editor.tools.align_start",
        "jsHandler": "$getEditor()?.chain().focus().setTextAlign('start').run()",
        "toggle": true,
        "icon": "nv-o-align-start",
        "activeJsExpression": "$getEditor()?.isActive({ textAlign: 'start' })",
        "iconAlias": "forms::components.rich-editor.toolbar.align-start"
    },
    {
        "name": "alignCenter",
        "label": "navette-forms::components.rich_editor.tools.align_center",
        "jsHandler": "$getEditor()?.chain().focus().setTextAlign('center').run()",
        "toggle": true,
        "icon": "nv-o-align-center",
        "activeJsExpression": "$getEditor()?.isActive({ textAlign: 'center' })",
        "iconAlias": "forms::components.rich-editor.toolbar.align-center"
    },
    {
        "name": "alignEnd",
        "label": "navette-forms::components.rich_editor.tools.align_end",
        "jsHandler": "$getEditor()?.chain().focus().setTextAlign('end').run()",
        "toggle": true,
        "icon": "nv-o-align-end",
        "activeJsExpression": "$getEditor()?.isActive({ textAlign: 'end' })",
        "iconAlias": "forms::components.rich-editor.toolbar.align-end"
    },
    {
        "name": "alignJustify",
        "label": "navette-forms::components.rich_editor.tools.align_justify",
        "jsHandler": "$getEditor()?.chain().focus().setTextAlign('justify').run()",
        "toggle": true,
        "icon": "nv-o-align-justify",
        "activeJsExpression": "$getEditor()?.isActive({ textAlign: 'justify' })",
        "iconAlias": "forms::components.rich-editor.toolbar.align-justify"
    },
    {
        "name": "grid",
        "label": "navette-forms::components.rich_editor.tools.grid",
        "action": "{}",
        "icon": "nv-o-columns",
        "activeJsExpression": "false",
        "iconAlias": "forms::components.rich-editor.toolbar.grid"
    },
    {
        "name": "gridAddColumnBefore",
        "label": "navette-forms::components.rich_editor.tools.table_add_column_before",
        "jsHandler": "$getEditor()?.chain().focus().addGridColumnBefore().run()",
        "icon": "nv-o-table-add-column-before",
        "activeJsExpression": "$getEditor()?.can().addGridColumnBefore()",
        "activeStyling": false,
        "disabledWhenNotActive": true,
        "extraAttributes": {
            "data-testid": "grid-add-column-before"
        },
        "iconAlias": "forms::components.rich-editor.toolbar.grid-add-column-before"
    },
    {
        "name": "gridAddColumnAfter",
        "label": "navette-forms::components.rich_editor.tools.table_add_column_after",
        "jsHandler": "$getEditor()?.chain().focus().addGridColumnAfter().run()",
        "icon": "nv-o-table-add-column-after",
        "activeJsExpression": "$getEditor()?.can().addGridColumnAfter()",
        "activeStyling": false,
        "disabledWhenNotActive": true,
        "extraAttributes": {
            "data-testid": "grid-add-column-after"
        },
        "iconAlias": "forms::components.rich-editor.toolbar.grid-add-column-after"
    },
    {
        "name": "gridDeleteColumn",
        "label": "navette-forms::components.rich_editor.tools.table_delete_column",
        "jsHandler": "$getEditor()?.chain().focus().deleteGridColumn().run()",
        "icon": "nv-o-table-delete-column",
        "activeJsExpression": "$getEditor()?.can().deleteGridColumn()",
        "activeStyling": false,
        "disabledWhenNotActive": true,
        "extraAttributes": {
            "data-testid": "grid-delete-column"
        },
        "iconAlias": "forms::components.rich-editor.toolbar.grid-delete-column"
    },
    {
        "name": "gridDelete",
        "label": "navette-forms::components.rich_editor.tools.grid_delete",
        "jsHandler": "$getEditor()?.chain().focus().deleteGrid().run()",
        "icon": "nv-o-columns-delete",
        "activeKey": "grid",
        "activeStyling": false,
        "disabledWhenNotActive": true,
        "iconAlias": "forms::components.rich-editor.toolbar.grid-delete"
    },
    {
        "name": "details",
        "label": "navette-forms::components.rich_editor.tools.details",
        "jsHandler": "$getEditor()?.chain().focus().setDetails().run()",
        "icon": "nv-o-details",
        "iconAlias": "forms::components.rich-editor.toolbar.details"
    },
    {
        "name": "clearFormatting",
        "label": "navette-forms::components.rich_editor.tools.clear_formatting",
        "jsHandler": "$getEditor()?.chain().focus().clearNodes().unsetAllMarks().run()",
        "icon": "nv-o-clear-formatting",
        "iconAlias": "forms::components.rich-editor.toolbar.clear-formatting"
    }
];
