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
            "Delete a file or instance from the workspace. This works for both data files "
            "and instances. This is a soft delete. Use when the user asks to "
            "delete, remove, or clear files or instances."
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
            "Create an instance of an app type for a data file. Instances are lightweight "
            "views that render the data file using a specific app (Table, Board, Calendar, "
            "Document, Text Editor, or a custom app). The instance appears nested under the "
            "data file in the sidebar and as a tab when viewing the file. Use this when the "
            "user wants a new way to view their data, e.g. 'show this CSV as a board'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "source_file_id": {
                    "type": "string",
                    "description": "The UUID of the data file to create an instance for",
                },
                "app_type_slug": {
                    "type": "string",
                    "description": (
                        "The slug of the app type to use. Built-in slugs: 'table', 'board', "
                        "'calendar', 'document', 'text-editor'. Or a custom app type slug."
                    ),
                },
                "name": {
                    "type": "string",
                    "description": "Optional custom name for the instance (defaults to 'FileName - AppLabel')",
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
            "required": ["source_file_id", "app_type_slug"],
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
            "Update an instance's config or content. Use this to customize how an instance "
            "renders its data — e.g. changing column visibility, sort order, color coding, "
            "or modifying the HTML template of a custom instance. Changes are saved to the "
            "instance only, not the parent app type."
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
            "Promote a customized instance into a new reusable app type. Takes the instance's "
            "current config/content and creates a new app type from it. The new app type appears "
            "in the Apps section and can be applied to other data files. Use this when the user "
            "has customized an instance and wants to reuse that pattern elsewhere."
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
