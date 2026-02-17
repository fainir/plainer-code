TOOLS = [
    {
        "name": "create_file",
        "description": (
            "Create a new file in the workspace. Use this when the user asks you to write "
            "code, create a document, make a spreadsheet, or generate any text-based file. "
            "The file will appear in the user's drive immediately."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "File name with extension, e.g. 'app.py', 'README.md', 'data.csv'",
                },
                "content": {
                    "type": "string",
                    "description": "The full content of the file",
                },
            },
            "required": ["name", "content"],
        },
    },
    {
        "name": "edit_file",
        "description": (
            "Edit an existing file in the workspace. Replaces the entire content of the file. "
            "A new version is created automatically. Use this when the user asks to modify, "
            "update, or fix an existing file."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "The UUID of the file to edit",
                },
                "new_content": {
                    "type": "string",
                    "description": "The complete new content of the file",
                },
                "change_summary": {
                    "type": "string",
                    "description": "Brief description of what was changed",
                },
            },
            "required": ["file_id", "new_content"],
        },
    },
    {
        "name": "read_file",
        "description": (
            "Read the content of a file in the workspace. Use this to understand what is "
            "in a file before editing it, or when the user asks about file contents."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "The UUID of the file to read",
                },
            },
            "required": ["file_id"],
        },
    },
    {
        "name": "list_files",
        "description": (
            "List all files in the workspace. Use this to understand the current "
            "file structure before creating or editing files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "delete_file",
        "description": (
            "Delete a file from the workspace. This works for both data files "
            "and view files. This is a soft delete. Use when the user asks to "
            "delete, remove, or clear files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "The UUID of the file to delete",
                },
            },
            "required": ["file_id"],
        },
    },
    {
        "name": "create_instance",
        "description": (
            "Create a view file for a data file. View files are visible in the folder listing "
            "alongside the data file and render it using a specific app (Table, Board, Calendar, "
            "Document, Text Editor, or a custom HTML view). Use this when the user wants a new "
            "way to view their data, e.g. 'show this CSV as a board'. "
            "For multi-file views (e.g. dashboards), use source_file_ids to link the view "
            "to all relevant files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "source_file_id": {
                    "type": "string",
                    "description": "The UUID of the primary data file. Use this for single-file views.",
                },
                "source_file_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "List of all source file UUIDs this view uses. The first is the primary "
                        "source; the rest are related. The view will appear linked under ALL these "
                        "files in the sidebar. Use this instead of source_file_id for multi-file "
                        "views like dashboards."
                    ),
                },
                "app_type_slug": {
                    "type": "string",
                    "description": (
                        "The slug of the app type to use. Built-in slugs: 'table', 'board', "
                        "'calendar', 'document', 'text-editor', 'custom-view'. Use 'custom-view' "
                        "for one-off custom HTML visualizations."
                    ),
                },
                "name": {
                    "type": "string",
                    "description": "Optional custom name for the view file (defaults to 'FileName AppLabel' or 'FileName AppLabel.html' for custom views)",
                },
                "config": {
                    "type": "string",
                    "description": "Optional JSON config string for the instance (sort order, filters, column settings, etc.)",
                },
                "content": {
                    "type": "string",
                    "description": "Optional HTML content for custom app type instances (html-template renderer)",
                },
            },
            "required": ["app_type_slug"],
        },
    },
    {
        "name": "create_app_type",
        "description": (
            "Create a new reusable app type with a custom HTML template. App types appear in "
            "the Apps section of the sidebar and can be used to create instances for any data "
            "file. Use this when the user wants a custom visualization that could be reused "
            "across multiple files, e.g. 'create a sales dashboard app'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "slug": {
                    "type": "string",
                    "description": "Unique identifier slug (lowercase, hyphens, e.g. 'sales-dashboard')",
                },
                "label": {
                    "type": "string",
                    "description": "Display name for the app type, e.g. 'Sales Dashboard'",
                },
                "icon": {
                    "type": "string",
                    "description": "Lucide icon name, e.g. 'bar-chart', 'layout-dashboard'",
                },
                "template_content": {
                    "type": "string",
                    "description": "The HTML template content for this app type. Should be a self-contained HTML app.",
                },
                "description": {
                    "type": "string",
                    "description": "Brief description of what this app type does",
                },
            },
            "required": ["slug", "label", "template_content"],
        },
    },
    {
        "name": "update_instance",
        "description": (
            "Update a view file's config or content. Use this to customize how a view "
            "renders its data — e.g. changing column visibility, sort order, color coding, "
            "or modifying the HTML of a custom view. Changes are saved to the "
            "view file only, not the parent app type."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "instance_id": {
                    "type": "string",
                    "description": "The UUID of the instance file to update",
                },
                "config": {
                    "type": "string",
                    "description": "New JSON config string (replaces existing config)",
                },
                "content": {
                    "type": "string",
                    "description": "New HTML content (for html-template instances)",
                },
            },
            "required": ["instance_id"],
        },
    },
    {
        "name": "promote_instance_to_app",
        "description": (
            "Promote a customized view file into a new reusable app type. Takes the view's "
            "current config/content and creates a new app type from it. The new app type appears "
            "in the Apps section and can be applied to other data files. Use this when the user "
            "has customized a view and wants to reuse that pattern elsewhere."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "instance_id": {
                    "type": "string",
                    "description": "The UUID of the customized instance to promote",
                },
                "slug": {
                    "type": "string",
                    "description": "Unique slug for the new app type (lowercase, hyphens)",
                },
                "label": {
                    "type": "string",
                    "description": "Display name for the new app type",
                },
                "icon": {
                    "type": "string",
                    "description": "Lucide icon name for the new app type",
                },
                "description": {
                    "type": "string",
                    "description": "Brief description of what this app type does",
                },
            },
            "required": ["instance_id", "slug", "label"],
        },
    },
    {
        "name": "toggle_favorite",
        "description": (
            "Toggle the favorite/star status of a file. Starred files appear in the "
            "Favorites section of the sidebar for quick access. Use when the user asks "
            "to star, favorite, pin, or unstar a file."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "The UUID of the file to star/unstar",
                },
            },
            "required": ["file_id"],
        },
    },
]
