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
            "Delete a file or view from the workspace. This works for both data files "
            "and HTML view files. This is a soft delete. Use when the user asks to "
            "delete, remove, or clear files or views."
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
        "name": "link_view",
        "description": (
            "Link an HTML view file to a data file. This makes the view appear as a tab "
            "when the user opens the data file. Use this after creating a custom HTML view "
            "for an existing data file."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "The UUID of the data file (e.g. CSV, Markdown) to link the view to",
                },
                "view_file_id": {
                    "type": "string",
                    "description": "The UUID of the HTML view file to link",
                },
                "label": {
                    "type": "string",
                    "description": "The tab label for this view, e.g. 'Dashboard', 'Chart'",
                },
            },
            "required": ["file_id", "view_file_id", "label"],
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
