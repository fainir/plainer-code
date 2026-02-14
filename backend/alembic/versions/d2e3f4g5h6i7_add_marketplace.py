"""add marketplace

Revision ID: d2e3f4g5h6i7
Revises: c1d2e3f4g5h6
Create Date: 2026-02-14 20:00:00.000000

"""
import json
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d2e3f4g5h6i7"
down_revision: Union[str, None] = "c1d2e3f4g5h6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _id():
    return str(uuid.uuid4())


def _cmd(slug, name, icon, category, prompt, requires_file, sort, description):
    return {
        "id": _id(), "item_type": "command", "slug": slug, "name": name,
        "icon": icon, "category": category, "is_builtin": True, "is_featured": not requires_file,
        "install_count": 0, "sort_order": sort,
        "description": description,
        "content": json.dumps({"prompt": prompt, "requires_file": requires_file}),
    }


def _ftpl(slug, name, icon, category, filename, content, sort, description):
    return {
        "id": _id(), "item_type": "file_template", "slug": slug, "name": name,
        "icon": icon, "category": category, "is_builtin": True, "is_featured": False,
        "install_count": 0, "sort_order": sort,
        "description": description,
        "content": json.dumps({"filename": filename, "content": content}),
    }


def _folder(slug, name, icon, category, root_name, structure, sort, description):
    return {
        "id": _id(), "item_type": "folder_template", "slug": slug, "name": name,
        "icon": icon, "category": category, "is_builtin": True, "is_featured": False,
        "install_count": 0, "sort_order": sort,
        "description": description,
        "content": json.dumps({"root_name": root_name, "structure": structure}),
    }


def _app(slug, name, icon, category, html, sort, description):
    return {
        "id": _id(), "item_type": "app", "slug": slug, "name": name,
        "icon": icon, "category": category, "is_builtin": True, "is_featured": False,
        "install_count": 0, "sort_order": sort,
        "description": description,
        "content": html,
    }


COMMANDS = [
    _cmd("cmd-summarize-file", "Summarize File", "file-text", "productivity",
         'Read the file "{file_name}" and provide a concise summary of its contents, key points, and structure.',
         True, 1, "Get a quick summary of any file's contents"),
    _cmd("cmd-create-readme", "Create README", "book-open", "creation",
         "Create a professional README.md file for my project. Include sections for: title, description, features, installation, usage, contributing, and license. Ask me about the project first.",
         False, 2, "Generate a professional README for your project"),
    _cmd("cmd-csv-analysis", "Analyze Data", "bar-chart-3", "analysis",
         'Read the file "{file_name}" and provide a detailed analysis: column descriptions, data types, row count, summary statistics, notable patterns, and any data quality issues.',
         True, 3, "Deep analysis of CSV/spreadsheet data"),
    _cmd("cmd-create-dashboard", "Build Dashboard", "layout-dashboard", "creation",
         'Read the file "{file_name}" and create an interactive HTML dashboard visualization for this data. Include charts, summary statistics, and filters where appropriate.',
         True, 4, "Create an interactive dashboard from your data"),
    _cmd("cmd-fix-code", "Fix & Improve Code", "wrench", "code",
         'Read the file "{file_name}" and identify bugs, potential issues, and areas for improvement. Then apply the fixes and improvements, explaining each change.',
         True, 5, "Find and fix bugs, improve code quality"),
    _cmd("cmd-meeting-notes", "Meeting Notes", "clipboard-list", "creation",
         "Create a structured meeting notes document. I'll tell you about the meeting and you'll organize it with: attendees, agenda items, discussion points, decisions made, and action items.",
         False, 6, "Create organized meeting notes from your input"),
    _cmd("cmd-convert-format", "Convert Format", "repeat", "productivity",
         'Read the file "{file_name}" and convert it to a different format. Ask me what format I\'d like (CSV to JSON, Markdown to HTML, etc.).',
         True, 7, "Convert files between formats"),
    _cmd("cmd-generate-api", "Generate API Docs", "server", "code",
         'Read the file "{file_name}" and generate comprehensive API documentation from this code. Include endpoints, parameters, request/response examples, and error codes.',
         True, 8, "Auto-generate API documentation from code"),
    _cmd("cmd-brainstorm", "Brainstorm Ideas", "lightbulb", "creation",
         "Help me brainstorm ideas. I'll give you a topic and you'll generate creative, diverse ideas organized by category. Let's start - what topic should we brainstorm about?",
         False, 9, "Generate creative ideas on any topic"),
    _cmd("cmd-create-tracker", "Project Tracker", "list-checks", "creation",
         "Create a project task tracker CSV file with columns: Task, Status, Priority, Assignee, Due Date, and Notes. Start with sample tasks and I'll customize from there.",
         False, 10, "Create a ready-to-use project task tracker"),
    _cmd("cmd-write-tests", "Write Tests", "test-tube", "code",
         'Read the file "{file_name}" and write comprehensive unit tests for this code. Cover edge cases, error handling, and typical usage patterns.',
         True, 11, "Generate unit tests for your code"),
    _cmd("cmd-explain-code", "Explain Code", "graduation-cap", "code",
         'Read the file "{file_name}" and provide a detailed explanation of how this code works. Break it down section by section, explain design patterns used, and note any complexity.',
         True, 12, "Get a detailed explanation of any code file"),
]

FILE_TEMPLATES = [
    _ftpl("tpl-readme", "Project README", "book-open", "docs", "README.md",
          "# Project Name\n\n> Brief description of your project.\n\n## Features\n\n- Feature 1\n- Feature 2\n- Feature 3\n\n## Installation\n\n```bash\n# Clone the repository\ngit clone https://github.com/user/project.git\ncd project\n\n# Install dependencies\nnpm install\n```\n\n## Usage\n\n```bash\nnpm start\n```\n\n## Configuration\n\n| Variable | Description | Default |\n|----------|-------------|---------|\n| `PORT` | Server port | `3000` |\n| `DB_URL` | Database URL | `localhost` |\n\n## Contributing\n\n1. Fork the repository\n2. Create your feature branch (`git checkout -b feature/amazing`)\n3. Commit your changes (`git commit -m 'Add amazing feature'`)\n4. Push to the branch (`git push origin feature/amazing`)\n5. Open a Pull Request\n\n## License\n\nMIT License - see [LICENSE](LICENSE) for details.",
          1, "Standard README with badges, features, installation, and more"),
    _ftpl("tpl-meeting-notes", "Meeting Notes", "clipboard-list", "docs", "meeting-notes.md",
          "# Meeting Notes\n\n**Date:** YYYY-MM-DD\n**Time:** HH:MM - HH:MM\n**Location:** \n\n## Attendees\n\n- [ ] Name 1\n- [ ] Name 2\n- [ ] Name 3\n\n## Agenda\n\n1. Topic 1\n2. Topic 2\n3. Topic 3\n\n## Discussion\n\n### Topic 1\n\n- Key point\n- Decision made\n\n### Topic 2\n\n- Key point\n- Open question\n\n## Decisions\n\n| Decision | Owner | Deadline |\n|----------|-------|----------|\n| Decision 1 | Name | Date |\n\n## Action Items\n\n- [ ] Action 1 - @Owner - Due: Date\n- [ ] Action 2 - @Owner - Due: Date\n\n## Next Meeting\n\n**Date:** \n**Agenda:** ",
          2, "Structured template for organizing meeting discussions"),
    _ftpl("tpl-weekly-report", "Weekly Report", "calendar-days", "docs", "weekly-report.md",
          "# Weekly Report\n\n**Week of:** YYYY-MM-DD\n**Author:** \n\n## Accomplishments\n\n- Completed task 1\n- Completed task 2\n- Completed task 3\n\n## In Progress\n\n- Working on feature X (70% complete)\n- Reviewing PR for feature Y\n\n## Blockers\n\n- Waiting on API access from team Z\n- Need design review for component A\n\n## Next Week Goals\n\n- [ ] Goal 1\n- [ ] Goal 2\n- [ ] Goal 3\n\n## Metrics\n\n| Metric | This Week | Last Week | Change |\n|--------|-----------|-----------|--------|\n| Tasks completed | 5 | 4 | +25% |\n| PRs merged | 3 | 2 | +50% |\n\n## Notes\n\nAny additional notes or observations.",
          3, "Weekly status report with accomplishments, blockers, and goals"),
    _ftpl("tpl-project-tasks", "Task Tracker", "list-checks", "productivity", "tasks.csv",
          "Task,Status,Priority,Assignee,Due Date,Notes\nSet up project repository,Done,High,Alice,2025-01-15,Repository created and initialized\nDesign database schema,Done,High,Bob,2025-01-20,ERD approved by team\nImplement user authentication,In Progress,High,Alice,2025-02-01,Using JWT tokens\nCreate API endpoints,In Progress,Medium,Charlie,2025-02-05,REST API design complete\nBuild frontend dashboard,Todo,Medium,Diana,2025-02-15,Wireframes ready\nWrite unit tests,Todo,Medium,Bob,2025-02-20,Target 80% coverage\nSet up CI/CD pipeline,Todo,Low,Charlie,2025-02-25,GitHub Actions\nPerformance optimization,Backlog,Low,Unassigned,,Profile after MVP",
          4, "CSV task tracker with status, priority, and assignees"),
    _ftpl("tpl-budget", "Budget Spreadsheet", "dollar-sign", "productivity", "budget.csv",
          "Category,Description,Planned,Actual,Difference\nRevenue,Product Sales,50000,48500,-1500\nRevenue,Service Fees,20000,22000,2000\nRevenue,Subscriptions,15000,14800,-200\nExpense,Salaries,35000,35000,0\nExpense,Office Rent,5000,5000,0\nExpense,Software Licenses,2000,2400,-400\nExpense,Marketing,8000,7200,800\nExpense,Travel,3000,1500,1500\nExpense,Equipment,4000,3800,200\nExpense,Utilities,1500,1600,-100\nExpense,Insurance,2000,2000,0\nExpense,Miscellaneous,1000,800,200",
          5, "Budget template with planned vs actual tracking"),
    _ftpl("tpl-contacts", "Contact List", "users", "productivity", "contacts.csv",
          "Name,Email,Phone,Company,Role,Notes\nAlice Johnson,alice@example.com,555-0101,Acme Corp,CTO,Key technical decision maker\nBob Smith,bob@example.com,555-0102,TechStart Inc,Founder,Met at conference 2024\nCarol Williams,carol@example.com,555-0103,Design Co,Lead Designer,Freelance collaboration\nDavid Brown,david@example.com,555-0104,DataFlow,Data Engineer,Referred by Alice\nEva Martinez,eva@example.com,555-0105,CloudBase,DevOps Lead,AWS expert",
          6, "Contact list with company, role, and notes"),
    _ftpl("tpl-changelog", "Changelog", "git-branch", "docs", "CHANGELOG.md",
          "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/).\n\n## [Unreleased]\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- \n\n## [1.0.0] - YYYY-MM-DD\n\n### Added\n- Initial release\n- Core feature 1\n- Core feature 2\n\n### Changed\n- Updated dependencies\n\n### Fixed\n- Bug fix description\n\n## [0.1.0] - YYYY-MM-DD\n\n### Added\n- Project scaffolding\n- Basic setup",
          7, "Keep a Changelog format with versioned entries"),
    _ftpl("tpl-python-script", "Python Script", "file-code", "code", "script.py",
          '"""Script description.\n\nUsage:\n    python script.py --input data.csv --output results.json\n"""\n\nimport argparse\nimport logging\nimport sys\nfrom pathlib import Path\n\nlogging.basicConfig(\n    level=logging.INFO,\n    format="%(asctime)s [%(levelname)s] %(message)s",\n)\nlogger = logging.getLogger(__name__)\n\n\ndef parse_args():\n    parser = argparse.ArgumentParser(description="Script description")\n    parser.add_argument("--input", "-i", required=True, help="Input file path")\n    parser.add_argument("--output", "-o", required=True, help="Output file path")\n    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")\n    return parser.parse_args()\n\n\ndef process(input_path: Path, output_path: Path) -> None:\n    """Main processing logic."""\n    logger.info(f"Reading from {input_path}")\n    # TODO: Add processing logic\n    logger.info(f"Writing to {output_path}")\n\n\ndef main():\n    args = parse_args()\n    if args.verbose:\n        logging.getLogger().setLevel(logging.DEBUG)\n\n    input_path = Path(args.input)\n    output_path = Path(args.output)\n\n    if not input_path.exists():\n        logger.error(f"Input file not found: {input_path}")\n        sys.exit(1)\n\n    try:\n        process(input_path, output_path)\n        logger.info("Done!")\n    except Exception as e:\n        logger.error(f"Failed: {e}")\n        sys.exit(1)\n\n\nif __name__ == "__main__":\n    main()\n',
          8, "Python script boilerplate with argparse, logging, and error handling"),
    _ftpl("tpl-html-page", "HTML Page", "globe", "code", "page.html",
          '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Page Title</title>\n  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }\n    header { background: #2563eb; color: white; padding: 1rem 2rem; }\n    nav { display: flex; gap: 1.5rem; margin-top: 0.5rem; }\n    nav a { color: rgba(255,255,255,0.8); text-decoration: none; }\n    nav a:hover { color: white; }\n    main { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }\n    h1 { font-size: 1.5rem; }\n    h2 { margin: 2rem 0 1rem; color: #1e40af; }\n    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; }\n    footer { text-align: center; padding: 2rem; color: #6b7280; font-size: 0.875rem; border-top: 1px solid #e5e7eb; margin-top: 3rem; }\n  </style>\n</head>\n<body>\n  <header>\n    <h1>Page Title</h1>\n    <nav>\n      <a href="#">Home</a>\n      <a href="#">About</a>\n      <a href="#">Contact</a>\n    </nav>\n  </header>\n  <main>\n    <h2>Welcome</h2>\n    <p>Start building your page here.</p>\n    <div class="card">\n      <h3>Card Title</h3>\n      <p>Card content goes here.</p>\n    </div>\n  </main>\n  <footer>\n    <p>&copy; 2025 Your Name. All rights reserved.</p>\n  </footer>\n</body>\n</html>',
          9, "Clean responsive HTML5 page with header, nav, and cards"),
    _ftpl("tpl-api-spec", "API Specification", "server", "docs", "api-spec.md",
          "# API Specification\n\n**Base URL:** `https://api.example.com/v1`\n**Version:** 1.0\n\n## Authentication\n\nAll requests require a Bearer token in the Authorization header:\n```\nAuthorization: Bearer <token>\n```\n\n## Endpoints\n\n### Users\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | /users | List all users |\n| POST | /users | Create a user |\n| GET | /users/:id | Get a user |\n| PUT | /users/:id | Update a user |\n| DELETE | /users/:id | Delete a user |\n\n### GET /users\n\n**Query Parameters:**\n| Param | Type | Required | Description |\n|-------|------|----------|-------------|\n| page | int | no | Page number (default: 1) |\n| limit | int | no | Items per page (default: 20) |\n\n**Response 200:**\n```json\n{\n  \"data\": [{\"id\": \"uuid\", \"email\": \"user@example.com\", \"name\": \"John\"}],\n  \"total\": 100,\n  \"page\": 1\n}\n```\n\n## Error Codes\n\n| Code | Description |\n|------|-------------|\n| 400 | Bad request |\n| 401 | Unauthorized |\n| 404 | Not found |\n| 500 | Server error |",
          10, "REST API documentation template with endpoints and examples"),
    _ftpl("tpl-decision-log", "Decision Log", "scale", "docs", "decisions.csv",
          "Decision,Date,Status,Context,Options Considered,Outcome,Owner\nUse PostgreSQL for database,2025-01-10,Approved,Need reliable RDBMS for complex queries,PostgreSQL vs MySQL vs MongoDB,PostgreSQL chosen for JSON support and reliability,Alice\nAdopt React for frontend,2025-01-12,Approved,Need modern SPA framework,React vs Vue vs Svelte,React chosen for ecosystem and team experience,Bob\nDeploy on Railway,2025-01-15,Approved,Need simple deployment platform,Railway vs Vercel vs AWS,Railway chosen for full-stack support,Charlie\nUse JWT for authentication,2025-01-18,Under Review,Need stateless auth,JWT vs Session vs OAuth only,Leaning toward JWT with refresh tokens,Alice",
          11, "Track architectural and project decisions"),
    _ftpl("tpl-sprint-board", "Sprint Board", "kanban", "productivity", "sprint.csv",
          "Task,Status,Points,Sprint,Assignee,Description\nUser login page,Done,3,Sprint 1,Alice,Login form with email/password\nRegistration flow,Done,5,Sprint 1,Alice,Sign up with email verification\nDashboard layout,Done,3,Sprint 1,Bob,Main dashboard grid layout\nAPI rate limiting,In Progress,2,Sprint 2,Charlie,Add rate limits to all endpoints\nFile upload feature,In Progress,5,Sprint 2,Diana,Support drag-and-drop uploads\nSearch functionality,Todo,8,Sprint 2,Bob,Full-text search across files\nNotification system,Todo,5,Sprint 3,Unassigned,Email and in-app notifications\nMobile responsive,Backlog,8,Unplanned,Unassigned,Make all pages mobile-friendly",
          12, "Sprint-based task board with points and assignees"),
]

FOLDER_TEMPLATES = [
    _folder("ftpl-web-project", "Web Project", "globe", "code", "Web Project", [
        {"type": "file", "name": "index.html", "content": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Web Project</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <h1>Hello World</h1>\n  <script src="app.js"></script>\n</body>\n</html>'},
        {"type": "file", "name": "styles.css", "content": "* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: system-ui, sans-serif; line-height: 1.6; padding: 2rem; }\nh1 { color: #2563eb; }"},
        {"type": "file", "name": "app.js", "content": "// Main application entry point\nconsole.log('App initialized');\n"},
        {"type": "file", "name": "README.md", "content": "# Web Project\n\nA simple web project.\n\n## Getting Started\n\nOpen `index.html` in your browser."},
    ], 1, "Basic web project with HTML, CSS, and JavaScript"),

    _folder("ftpl-python-project", "Python Project", "file-code", "code", "Python Project", [
        {"type": "folder", "name": "src", "children": [
            {"type": "file", "name": "__init__.py", "content": ""},
            {"type": "file", "name": "main.py", "content": '"""Main application module."""\n\n\ndef main():\n    print("Hello, World!")\n\n\nif __name__ == "__main__":\n    main()\n'},
        ]},
        {"type": "folder", "name": "tests", "children": [
            {"type": "file", "name": "test_main.py", "content": '"""Tests for main module."""\nfrom src.main import main\n\n\ndef test_main(capsys):\n    main()\n    captured = capsys.readouterr()\n    assert "Hello" in captured.out\n'},
        ]},
        {"type": "file", "name": "requirements.txt", "content": "# Add your dependencies here\npytest>=8.0\n"},
        {"type": "file", "name": "README.md", "content": "# Python Project\n\n## Setup\n```bash\npython -m venv .venv\nsource .venv/bin/activate\npip install -r requirements.txt\n```\n\n## Run\n```bash\npython -m src.main\n```\n\n## Test\n```bash\npytest\n```"},
    ], 2, "Python project with src, tests, and package structure"),

    _folder("ftpl-documentation", "Documentation Site", "book-open", "docs", "Documentation", [
        {"type": "file", "name": "index.md", "content": "# Documentation\n\nWelcome to the documentation.\n\n## Quick Links\n\n- [Getting Started](getting-started.md)\n- [API Reference](api-reference.md)\n- [FAQ](faq.md)"},
        {"type": "file", "name": "getting-started.md", "content": "# Getting Started\n\n## Prerequisites\n\n- Requirement 1\n- Requirement 2\n\n## Installation\n\nStep-by-step installation guide.\n\n## First Steps\n\n1. Step one\n2. Step two\n3. Step three"},
        {"type": "file", "name": "api-reference.md", "content": "# API Reference\n\n## Endpoints\n\n### GET /resource\n\nDescription of endpoint.\n\n**Parameters:**\n| Name | Type | Description |\n|------|------|-------------|\n| id | string | Resource ID |\n\n**Response:**\n```json\n{\"id\": \"123\", \"name\": \"example\"}\n```"},
        {"type": "file", "name": "faq.md", "content": "# Frequently Asked Questions\n\n## General\n\n**Q: What is this project?**\nA: Description here.\n\n**Q: How do I get started?**\nA: See [Getting Started](getting-started.md).\n\n## Technical\n\n**Q: What stack is used?**\nA: Description of tech stack."},
        {"type": "file", "name": "CONTRIBUTING.md", "content": "# Contributing\n\nThank you for contributing!\n\n## Process\n\n1. Fork the repo\n2. Create a branch\n3. Make changes\n4. Submit a PR\n\n## Style Guide\n\n- Use clear, concise language\n- Include code examples\n- Keep paragraphs short"},
    ], 3, "Documentation site with guides, API reference, and FAQ"),

    _folder("ftpl-project-mgmt", "Project Management", "briefcase", "productivity", "Project Management", [
        {"type": "file", "name": "tasks.csv", "content": "Task,Status,Priority,Assignee,Due Date,Notes\nProject kickoff,Done,High,Team Lead,2025-01-15,Completed\nRequirements gathering,In Progress,High,Analyst,2025-01-30,Stakeholder interviews ongoing\nDesign review,Todo,Medium,Designer,2025-02-10,\nDevelopment sprint 1,Todo,High,Dev Team,2025-02-28,"},
        {"type": "file", "name": "timeline.csv", "content": "Phase,Start Date,End Date,Status,Owner\nPlanning,2025-01-01,2025-01-15,Done,PM\nDesign,2025-01-16,2025-02-01,In Progress,Designer\nDevelopment,2025-02-01,2025-03-15,Upcoming,Dev Team\nTesting,2025-03-16,2025-03-31,Upcoming,QA\nLaunch,2025-04-01,2025-04-07,Upcoming,PM"},
        {"type": "file", "name": "meeting-notes.md", "content": "# Project Meeting Notes\n\n## Kickoff - 2025-01-15\n\n### Attendees\n- Team Lead, Designer, Developer, QA\n\n### Decisions\n- Sprint length: 2 weeks\n- Standup: Daily at 10am\n\n### Action Items\n- [ ] Set up project board\n- [ ] Schedule design review"},
        {"type": "file", "name": "decisions.csv", "content": "Decision,Date,Status,Context,Outcome,Owner\nUse agile methodology,2025-01-15,Approved,Team preference,2-week sprints,PM"},
        {"type": "file", "name": "README.md", "content": "# Project Management\n\nProject tracking files.\n\n## Files\n- `tasks.csv` - Task tracker\n- `timeline.csv` - Project timeline\n- `meeting-notes.md` - Meeting notes\n- `decisions.csv` - Decision log"},
    ], 4, "Project management kit with tasks, timeline, and meeting notes"),

    _folder("ftpl-startup-kit", "Startup Kit", "rocket", "business", "Startup Kit", [
        {"type": "folder", "name": "planning", "children": [
            {"type": "file", "name": "business-model.md", "content": "# Business Model Canvas\n\n## Value Proposition\nWhat problem do we solve?\n\n## Customer Segments\nWho are our customers?\n\n## Channels\nHow do we reach customers?\n\n## Revenue Streams\nHow do we make money?\n\n## Key Resources\nWhat do we need?\n\n## Key Activities\nWhat must we do?\n\n## Key Partners\nWho do we work with?\n\n## Cost Structure\nWhat are our costs?"},
            {"type": "file", "name": "market-research.md", "content": "# Market Research\n\n## Market Size\n- TAM: \n- SAM: \n- SOM: \n\n## Competitors\n| Competitor | Strengths | Weaknesses |\n|-----------|-----------|------------|\n| Comp A | Feature X | Slow | \n\n## Target Customer\n- Demographics: \n- Pain points: \n- Current solutions: "},
        ]},
        {"type": "folder", "name": "finance", "children": [
            {"type": "file", "name": "budget.csv", "content": "Category,Q1,Q2,Q3,Q4\nRevenue,0,5000,15000,30000\nSalaries,12000,12000,24000,24000\nMarketing,2000,5000,8000,10000\nInfrastructure,500,1000,2000,3000\nLegal,3000,500,500,500"},
            {"type": "file", "name": "projections.csv", "content": "Metric,Month 1,Month 3,Month 6,Month 12\nUsers,50,500,2000,10000\nMRR,0,500,5000,25000\nChurn Rate,N/A,10%,7%,5%\nCAC,N/A,$50,$30,$20"},
        ]},
        {"type": "file", "name": "README.md", "content": "# Startup Kit\n\nEverything you need to plan your startup.\n\n## Contents\n- `planning/` - Business model and market research\n- `finance/` - Budget and projections"},
    ], 5, "Startup planning kit with business model, research, and finances"),

    _folder("ftpl-course-notes", "Course Notes", "graduation-cap", "education", "Course Notes", [
        {"type": "folder", "name": "week-01", "children": [
            {"type": "file", "name": "notes.md", "content": "# Week 1: Introduction\n\n## Key Concepts\n\n- Concept 1\n- Concept 2\n\n## Summary\n\nWeek 1 covered the fundamentals."},
            {"type": "file", "name": "exercises.md", "content": "# Week 1 Exercises\n\n## Exercise 1\nDescription\n\n## Exercise 2\nDescription"},
        ]},
        {"type": "folder", "name": "week-02", "children": [
            {"type": "file", "name": "notes.md", "content": "# Week 2: Deep Dive\n\n## Key Concepts\n\n- Advanced concept 1\n- Advanced concept 2"},
            {"type": "file", "name": "exercises.md", "content": "# Week 2 Exercises\n\n## Exercise 1\nDescription"},
        ]},
        {"type": "file", "name": "syllabus.md", "content": "# Course Syllabus\n\n## Schedule\n| Week | Topic | Reading |\n|------|-------|---------|\n| 1 | Introduction | Ch. 1-2 |\n| 2 | Deep Dive | Ch. 3-4 |"},
        {"type": "file", "name": "resources.md", "content": "# Resources\n\n## Textbooks\n- Book 1\n- Book 2\n\n## Online\n- Link 1\n- Link 2"},
    ], 6, "Course note-taking structure with weekly folders"),

    _folder("ftpl-design-system", "Design System", "palette", "design", "Design System", [
        {"type": "folder", "name": "tokens", "children": [
            {"type": "file", "name": "colors.md", "content": "# Colors\n\n## Primary\n- Blue 600: `#2563eb`\n- Blue 700: `#1d4ed8`\n\n## Neutral\n- Gray 50: `#f9fafb`\n- Gray 900: `#111827`\n\n## Semantic\n- Success: `#16a34a`\n- Error: `#dc2626`\n- Warning: `#d97706`"},
            {"type": "file", "name": "typography.md", "content": "# Typography\n\n## Font Family\n- Primary: Inter, system-ui, sans-serif\n- Mono: JetBrains Mono, monospace\n\n## Scale\n| Name | Size | Weight | Line Height |\n|------|------|--------|-------------|\n| H1 | 2rem | 700 | 1.2 |\n| H2 | 1.5rem | 600 | 1.3 |\n| Body | 1rem | 400 | 1.6 |"},
        ]},
        {"type": "folder", "name": "components", "children": [
            {"type": "file", "name": "buttons.md", "content": "# Buttons\n\n## Variants\n- Primary: Blue background, white text\n- Secondary: Gray background, dark text\n- Ghost: Transparent, colored text\n\n## Sizes\n- sm: 32px height\n- md: 40px height\n- lg: 48px height"},
            {"type": "file", "name": "forms.md", "content": "# Forms\n\n## Input\n- Border: 1px solid gray-300\n- Border radius: 8px\n- Padding: 8px 12px\n\n## Labels\n- Font size: 14px\n- Font weight: 500\n- Color: gray-700"},
        ]},
        {"type": "file", "name": "README.md", "content": "# Design System\n\nDesign tokens and component specifications.\n\n## Structure\n- `tokens/` - Colors, typography, spacing\n- `components/` - Component specs"},
    ], 7, "Design system with tokens, colors, typography, and components"),

    _folder("ftpl-data-analysis", "Data Analysis", "bar-chart-3", "analysis", "Data Analysis", [
        {"type": "folder", "name": "data", "children": [
            {"type": "file", "name": "sample-data.csv", "content": "Date,Category,Value,Region\n2025-01-01,Sales,1200,North\n2025-01-01,Sales,980,South\n2025-01-02,Sales,1350,North\n2025-01-02,Sales,1100,South\n2025-01-03,Marketing,500,North\n2025-01-03,Marketing,650,South"},
        ]},
        {"type": "folder", "name": "analysis", "children": [
            {"type": "file", "name": "exploration.md", "content": "# Data Exploration\n\n## Dataset Overview\n- Rows: \n- Columns: \n- Date range: \n\n## Column Analysis\n| Column | Type | Unique | Missing |\n|--------|------|--------|---------|\n\n## Initial Findings\n- Finding 1\n- Finding 2"},
        ]},
        {"type": "folder", "name": "reports", "children": [
            {"type": "file", "name": "summary.md", "content": "# Analysis Summary\n\n## Key Findings\n1. Finding 1\n2. Finding 2\n\n## Recommendations\n- Recommendation 1\n- Recommendation 2"},
        ]},
        {"type": "file", "name": "README.md", "content": "# Data Analysis\n\n## Structure\n- `data/` - Raw data files\n- `analysis/` - Exploration and methodology\n- `reports/` - Final reports and summaries"},
    ], 8, "Data analysis project with raw data, exploration, and reports"),

    _folder("ftpl-blog", "Blog", "pen-tool", "creation", "Blog", [
        {"type": "folder", "name": "posts", "children": [
            {"type": "file", "name": "first-post.md", "content": "# My First Blog Post\n\n*Published: 2025-01-15*\n\n## Introduction\n\nWelcome to my blog!\n\n## Main Content\n\nThis is where the main content goes.\n\n## Conclusion\n\nThanks for reading!"},
            {"type": "file", "name": "second-post.md", "content": "# Another Great Post\n\n*Published: 2025-01-22*\n\n## Topic\n\nExploring interesting ideas.\n\n## Details\n\nMore content here."},
        ]},
        {"type": "folder", "name": "drafts", "children": [
            {"type": "file", "name": "upcoming-post.md", "content": "# Draft: Upcoming Topic\n\n*Status: Draft*\n\n## Outline\n- Point 1\n- Point 2\n- Point 3"},
        ]},
        {"type": "file", "name": "README.md", "content": "# Blog\n\n## Structure\n- `posts/` - Published blog posts\n- `drafts/` - Work in progress"},
    ], 9, "Blog structure with published posts and drafts"),

    _folder("ftpl-research", "Research Project", "microscope", "education", "Research Project", [
        {"type": "folder", "name": "literature", "children": [
            {"type": "file", "name": "references.csv", "content": "Title,Author,Year,Type,Key Finding,URL\nStudy on X,Smith et al.,2024,Journal,Found significant correlation,https://example.com\nReview of Y,Johnson,2023,Review,Comprehensive overview,https://example.com"},
            {"type": "file", "name": "notes.md", "content": "# Literature Notes\n\n## Smith et al. (2024)\n- Key finding: ...\n- Methodology: ...\n- Relevance: ...\n\n## Johnson (2023)\n- Key finding: ...\n- Gaps identified: ..."},
        ]},
        {"type": "folder", "name": "methodology", "children": [
            {"type": "file", "name": "approach.md", "content": "# Methodology\n\n## Research Question\nWhat is the relationship between X and Y?\n\n## Approach\n- Data collection method\n- Analysis technique\n- Expected outcomes\n\n## Limitations\n- Limitation 1\n- Limitation 2"},
        ]},
        {"type": "folder", "name": "results", "children": [
            {"type": "file", "name": "data.csv", "content": "Variable,Group A,Group B,P-Value\nMeasure 1,45.2,38.7,0.03\nMeasure 2,12.1,11.8,0.45\nMeasure 3,78.5,82.3,0.01"},
            {"type": "file", "name": "analysis.md", "content": "# Results Analysis\n\n## Summary Statistics\n- Sample size: \n- Significant findings: \n\n## Discussion\nInterpretation of results."},
        ]},
        {"type": "file", "name": "README.md", "content": "# Research Project\n\n## Structure\n- `literature/` - References and literature notes\n- `methodology/` - Research approach\n- `results/` - Data and analysis"},
    ], 10, "Academic research project with literature, methodology, and results"),
]

# App HTML templates - self-contained single-file apps
_TIMELINE_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:20px;background:#f8fafc}.timeline{position:relative;max-width:900px;margin:0 auto}.timeline::before{content:'';position:absolute;left:50%;width:2px;height:100%;background:#e2e8f0;transform:translateX(-50%)}.item{display:flex;margin-bottom:20px;position:relative}.item:nth-child(odd){flex-direction:row-reverse}.item .content{width:45%;padding:16px;background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);border:1px solid #e2e8f0}.item .content h3{color:#1e40af;margin-bottom:4px;font-size:14px}.item .content p{color:#64748b;font-size:13px}.item .content .date{font-size:11px;color:#94a3b8;margin-top:8px}.dot{position:absolute;left:50%;width:12px;height:12px;background:#3b82f6;border-radius:50%;transform:translateX(-50%);top:20px;z-index:1}h1{text-align:center;color:#1e293b;margin-bottom:30px;font-size:20px}</style></head><body><h1>Timeline</h1><div class="timeline" id="timeline"></div><script>function render(csv){const lines=csv.trim().split('\\n');const headers=lines[0].split(',').map(h=>h.trim().toLowerCase());const dateIdx=headers.findIndex(h=>h.includes('date'));const titleIdx=headers.findIndex(h=>h.includes('name')||h.includes('title')||h.includes('task')||h.includes('event'));const descIdx=headers.findIndex(h=>h.includes('desc')||h.includes('note')||h.includes('status'));const el=document.getElementById('timeline');lines.slice(1).forEach(line=>{const cols=line.split(',').map(c=>c.trim());const date=dateIdx>=0?cols[dateIdx]:'';const title=titleIdx>=0?cols[titleIdx]:cols[0];const desc=descIdx>=0?cols[descIdx]:'';el.innerHTML+=`<div class="item"><div class="content"><h3>${title}</h3>${desc?`<p>${desc}</p>`:''}<div class="date">${date}</div></div><div class="dot"></div></div>`;});}const data=document.body.getAttribute('data-csv')||window.__SOURCE_CSV__||'';if(data)render(data);else document.body.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px">No data. Attach a CSV file with date and title columns.</p>';</script></body></html>'''

_PIE_CHART_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:20px;background:#f8fafc;display:flex;flex-direction:column;align-items:center}h1{color:#1e293b;margin-bottom:20px;font-size:20px}svg{filter:drop-shadow(0 2px 4px rgba(0,0,0,0.1))}.legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px;justify-content:center}.legend-item{display:flex;align-items:center;gap:6px;font-size:13px;color:#475569}.swatch{width:14px;height:14px;border-radius:3px}</style></head><body><h1>Distribution</h1><svg id="chart" width="300" height="300" viewBox="-1.1 -1.1 2.2 2.2"></svg><div class="legend" id="legend"></div><script>const COLORS=['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16'];function render(csv){const lines=csv.trim().split('\\n');const headers=lines[0].split(',').map(h=>h.trim().toLowerCase());const labelIdx=0;const valIdx=headers.findIndex(h=>!isNaN(parseFloat(lines[1]?.split(',')[headers.indexOf(h)]?.trim())));const data=[];lines.slice(1).forEach(line=>{const cols=line.split(',').map(c=>c.trim());const v=parseFloat(cols[valIdx>=0?valIdx:1]);if(!isNaN(v))data.push({label:cols[labelIdx],value:v});});const total=data.reduce((s,d)=>s+d.value,0);let angle=0;const svg=document.getElementById('chart');const legend=document.getElementById('legend');data.forEach((d,i)=>{const pct=d.value/total;const a1=angle;const a2=angle+pct*Math.PI*2;const large=pct>0.5?1:0;const x1=Math.cos(a1),y1=Math.sin(a1),x2=Math.cos(a2),y2=Math.sin(a2);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M 0 0 L ${x1} ${y1} A 1 1 0 ${large} 1 ${x2} ${y2} Z`);path.setAttribute('fill',COLORS[i%COLORS.length]);path.style.cursor='pointer';path.innerHTML=`<title>${d.label}: ${d.value} (${(pct*100).toFixed(1)}%)</title>`;svg.appendChild(path);legend.innerHTML+=`<div class="legend-item"><div class="swatch" style="background:${COLORS[i%COLORS.length]}"></div>${d.label} (${(pct*100).toFixed(1)}%)</div>`;angle=a2;});}const data=document.body.getAttribute('data-csv')||window.__SOURCE_CSV__||'';if(data)render(data);else document.body.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px">No data.</p>';</script></body></html>'''

_BAR_CHART_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:20px;background:#f8fafc}h1{text-align:center;color:#1e293b;margin-bottom:20px;font-size:20px}.chart{max-width:700px;margin:0 auto}.bar-row{display:flex;align-items:center;margin-bottom:8px}.label{width:120px;text-align:right;padding-right:12px;font-size:13px;color:#475569;flex-shrink:0}.bar-container{flex:1;background:#f1f5f9;border-radius:6px;height:28px;position:relative;overflow:hidden}.bar{height:100%;border-radius:6px;transition:width 0.5s;display:flex;align-items:center;padding-left:8px}.bar span{font-size:11px;color:white;font-weight:600}</style></head><body><h1>Bar Chart</h1><div class="chart" id="chart"></div><script>const COLORS=['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#14b8a6'];function render(csv){const lines=csv.trim().split('\\n');const headers=lines[0].split(',').map(h=>h.trim());const data=[];lines.slice(1).forEach(line=>{const cols=line.split(',').map(c=>c.trim());const nums=cols.slice(1).map(Number).filter(n=>!isNaN(n));if(nums.length)data.push({label:cols[0],values:nums});});const max=Math.max(...data.flatMap(d=>d.values));const el=document.getElementById('chart');data.forEach((d,i)=>{d.values.forEach((v,j)=>{const pct=(v/max*100).toFixed(1);el.innerHTML+=`<div class="bar-row"><div class="label">${d.label}${d.values.length>1?' ('+headers[j+1]+')':''}</div><div class="bar-container"><div class="bar" style="width:${pct}%;background:${COLORS[j%COLORS.length]}"><span>${v}</span></div></div></div>`;});});}const data=document.body.getAttribute('data-csv')||window.__SOURCE_CSV__||'';if(data)render(data);else document.body.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px">No data.</p>';</script></body></html>'''

_SUMMARY_STATS_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:20px;background:#f8fafc}h1{text-align:center;color:#1e293b;margin-bottom:20px;font-size:20px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;max-width:900px;margin:0 auto}.card{background:white;border-radius:12px;padding:16px;border:1px solid #e2e8f0}.card h3{font-size:13px;color:#64748b;margin-bottom:8px}.stat{font-size:24px;font-weight:700;color:#1e293b}.meta{font-size:11px;color:#94a3b8;margin-top:4px}table{width:100%;max-width:900px;margin:20px auto 0;border-collapse:collapse;font-size:13px}th{background:#f1f5f9;padding:8px 12px;text-align:left;color:#475569;font-weight:600}td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155}</style></head><body><h1>Summary Statistics</h1><div class="grid" id="cards"></div><table id="table"><thead id="thead"></thead><tbody id="tbody"></tbody></table><script>function render(csv){const lines=csv.trim().split('\\n');const headers=lines[0].split(',').map(h=>h.trim());const data=lines.slice(1).map(l=>l.split(',').map(c=>c.trim()));const cards=document.getElementById('cards');const numCols=[];headers.forEach((h,i)=>{const vals=data.map(r=>parseFloat(r[i])).filter(v=>!isNaN(v));if(vals.length>data.length*0.5)numCols.push({name:h,vals});});cards.innerHTML=`<div class="card"><h3>Total Rows</h3><div class="stat">${data.length}</div><meta class="meta">${headers.length} columns</div>`;numCols.forEach(col=>{const sum=col.vals.reduce((a,b)=>a+b,0);const avg=sum/col.vals.length;const min=Math.min(...col.vals);const max=Math.max(...col.vals);cards.innerHTML+=`<div class="card"><h3>${col.name}</h3><div class="stat">${avg.toFixed(1)}</div><div class="meta">avg &middot; min ${min} &middot; max ${max} &middot; sum ${sum.toFixed(0)}</div></div>`;});document.getElementById('thead').innerHTML='<tr>'+headers.map(h=>`<th>${h}</th>`).join('')+'</tr>';document.getElementById('tbody').innerHTML=data.slice(0,20).map(r=>'<tr>'+r.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('');}const data=document.body.getAttribute('data-csv')||window.__SOURCE_CSV__||'';if(data)render(data);else document.body.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px">No data.</p>';</script></body></html>'''

_GALLERY_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:20px;background:#f8fafc}h1{text-align:center;color:#1e293b;margin-bottom:20px;font-size:20px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;max-width:1200px;margin:0 auto}.card{background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;transition:transform 0.2s,box-shadow 0.2s}.card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.1)}.card-body{padding:16px}.card-body h3{font-size:15px;color:#1e293b;margin-bottom:4px}.card-body p{font-size:13px;color:#64748b;line-height:1.4}.tag{display:inline-block;padding:2px 8px;background:#eff6ff;color:#3b82f6;border-radius:12px;font-size:11px;margin-top:8px}</style></head><body><h1>Gallery</h1><div class="grid" id="grid"></div><script>function render(csv){const lines=csv.trim().split('\\n');const headers=lines[0].split(',').map(h=>h.trim());const el=document.getElementById('grid');lines.slice(1).forEach(line=>{const cols=line.split(',').map(c=>c.trim());let html='<div class="card"><div class="card-body">';html+=`<h3>${cols[0]}</h3>`;cols.slice(1).forEach((c,i)=>{if(c)html+=`<p><strong>${headers[i+1]}:</strong> ${c}</p>`;});html+='</div></div>';el.innerHTML+=html;});}const data=document.body.getAttribute('data-csv')||window.__SOURCE_CSV__||'';if(data)render(data);else document.body.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px">No data.</p>';</script></body></html>'''

_GANTT_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:20px;background:#f8fafc}h1{text-align:center;color:#1e293b;margin-bottom:20px;font-size:20px}.gantt{max-width:900px;margin:0 auto;overflow-x:auto}.row{display:flex;align-items:center;margin-bottom:4px;min-height:32px}.label{width:160px;font-size:13px;color:#475569;flex-shrink:0;padding-right:12px;text-align:right}.track{flex:1;background:#f1f5f9;border-radius:4px;height:24px;position:relative}.bar{position:absolute;height:100%;border-radius:4px;min-width:8px;display:flex;align-items:center;padding:0 8px}.bar span{font-size:10px;color:white;font-weight:600;white-space:nowrap}.header{display:flex;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}.header .label{font-weight:600;color:#1e293b}</style></head><body><h1>Gantt Chart</h1><div class="gantt" id="gantt"></div><script>const COLORS=['#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ef4444','#ec4899'];function render(csv){const lines=csv.trim().split('\\n');const h=lines[0].split(',').map(s=>s.trim().toLowerCase());const nameI=0;const startI=h.findIndex(x=>x.includes('start'));const endI=h.findIndex(x=>x.includes('end'));const statusI=h.findIndex(x=>x.includes('status'));if(startI<0||endI<0){document.body.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px">Need start_date and end_date columns.</p>';return;}const tasks=[];let minD=Infinity,maxD=-Infinity;lines.slice(1).forEach(l=>{const c=l.split(',').map(s=>s.trim());const s=new Date(c[startI]).getTime(),e=new Date(c[endI]).getTime();if(!isNaN(s)&&!isNaN(e)){tasks.push({name:c[nameI],start:s,end:e,status:statusI>=0?c[statusI]:''});minD=Math.min(minD,s);maxD=Math.max(maxD,e);}});const range=maxD-minD||1;const el=document.getElementById('gantt');tasks.forEach((t,i)=>{const left=((t.start-minD)/range*100).toFixed(1);const width=(((t.end-t.start)/range)*100).toFixed(1);const color=COLORS[i%COLORS.length];el.innerHTML+=`<div class="row"><div class="label">${t.name}</div><div class="track"><div class="bar" style="left:${left}%;width:${width}%;background:${color}"><span>${t.status}</span></div></div></div>`;});}const data=document.body.getAttribute('data-csv')||window.__SOURCE_CSV__||'';if(data)render(data);else document.body.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px">No data.</p>';</script></body></html>'''

_HEATMAP_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:20px;background:#f8fafc}h1{text-align:center;color:#1e293b;margin-bottom:20px;font-size:20px}.heatmap{max-width:900px;margin:0 auto;overflow-x:auto}table{border-collapse:separate;border-spacing:2px}th{padding:6px 12px;font-size:12px;color:#64748b;font-weight:600}td{padding:8px 12px;text-align:center;font-size:12px;color:white;font-weight:600;border-radius:4px;min-width:60px}</style></head><body><h1>Heatmap</h1><div class="heatmap"><table id="table"></table></div><script>function render(csv){const lines=csv.trim().split('\\n');const headers=lines[0].split(',').map(h=>h.trim());const data=lines.slice(1).map(l=>l.split(',').map(c=>c.trim()));const nums=[];data.forEach(r=>r.slice(1).forEach(c=>{const n=parseFloat(c);if(!isNaN(n))nums.push(n);}));const min=Math.min(...nums),max=Math.max(...nums),range=max-min||1;function color(v){const t=(v-min)/range;const r=Math.round(59+t*196),g=Math.round(130-t*90),b=Math.round(246-t*200);return`rgb(${r},${g},${b})`;}const el=document.getElementById('table');let html='<tr><th></th>'+headers.slice(1).map(h=>`<th>${h}</th>`).join('')+'</tr>';data.forEach(r=>{html+='<tr><th style="text-align:right">'+r[0]+'</th>';r.slice(1).forEach(c=>{const n=parseFloat(c);html+=isNaN(n)?`<td style="background:#f1f5f9;color:#94a3b8">${c}</td>`:`<td style="background:${color(n)}">${c}</td>`;});html+='</tr>';});el.innerHTML=html;}const data=document.body.getAttribute('data-csv')||window.__SOURCE_CSV__||'';if(data)render(data);else document.body.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px">No data.</p>';</script></body></html>'''

_TREEMAP_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:20px;background:#f8fafc}h1{text-align:center;color:#1e293b;margin-bottom:20px;font-size:20px}#treemap{max-width:800px;height:500px;margin:0 auto;position:relative;border-radius:8px;overflow:hidden}.cell{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid white;overflow:hidden;transition:opacity 0.2s;cursor:default}.cell:hover{opacity:0.85}.cell .name{font-size:13px;font-weight:600;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.3)}.cell .value{font-size:11px;color:rgba(255,255,255,0.8)}</style></head><body><h1>Treemap</h1><div id="treemap"></div><script>const COLORS=['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316'];function render(csv){const lines=csv.trim().split('\\n');const h=lines[0].split(',').map(s=>s.trim());const data=[];lines.slice(1).forEach(l=>{const c=l.split(',').map(s=>s.trim());const v=c.slice(1).map(Number).find(n=>!isNaN(n)&&n>0);if(v)data.push({label:c[0],value:v});});data.sort((a,b)=>b.value-a.value);const total=data.reduce((s,d)=>s+d.value,0);const el=document.getElementById('treemap');const W=el.offsetWidth,H=el.offsetHeight;let x=0,y=0,w=W,h2=H;data.forEach((d,i)=>{const ratio=d.value/total;let cw,ch;if(w>=h2){cw=w*ratio/(data.slice(i).reduce((s,dd)=>s+dd.value,0)/total);ch=h2;if(i===data.length-1)cw=w;}else{cw=w;ch=h2*ratio/(data.slice(i).reduce((s,dd)=>s+dd.value,0)/total);if(i===data.length-1)ch=h2;}el.innerHTML+=`<div class="cell" style="left:${x}px;top:${y}px;width:${cw}px;height:${ch}px;background:${COLORS[i%COLORS.length]}"><span class="name">${d.label}</span><span class="value">${d.value}</span></div>`;if(w>=h2){x+=cw;}else{y+=ch;}});}const data=document.body.getAttribute('data-csv')||window.__SOURCE_CSV__||'';if(data)render(data);else document.body.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px">No data.</p>';</script></body></html>'''

_PIVOT_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:20px;background:#f8fafc}h1{text-align:center;color:#1e293b;margin-bottom:20px;font-size:20px}.controls{display:flex;gap:12px;max-width:900px;margin:0 auto 16px;flex-wrap:wrap}select{padding:6px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#334155}label{font-size:12px;color:#64748b;display:flex;flex-direction:column;gap:4px}table{width:100%;max-width:900px;margin:0 auto;border-collapse:collapse;font-size:13px}th{background:#f1f5f9;padding:8px 12px;text-align:left;color:#475569;font-weight:600;border-bottom:2px solid #e2e8f0}td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155}td.num{text-align:right;font-variant-numeric:tabular-nums}tr:hover td{background:#f8fafc}.total{font-weight:700;background:#f1f5f9}</style></head><body><h1>Pivot Table</h1><div class="controls" id="controls"></div><table id="table"></table><script>let CSV_DATA=[];let HEADERS=[];function parse(csv){const lines=csv.trim().split('\\n');HEADERS=lines[0].split(',').map(h=>h.trim());CSV_DATA=lines.slice(1).map(l=>l.split(',').map(c=>c.trim()));}function buildControls(){const c=document.getElementById('controls');const numCols=HEADERS.filter((h,i)=>CSV_DATA.some(r=>!isNaN(parseFloat(r[i]))));const catCols=HEADERS.filter(h=>!numCols.includes(h));c.innerHTML=`<label>Row<select id="rowSel">${catCols.map(h=>`<option>${h}</option>`).join('')}</select></label><label>Value<select id="valSel">${numCols.map(h=>`<option>${h}</option>`).join('')}</select></label><label>Aggregate<select id="aggSel"><option>Sum</option><option>Average</option><option>Count</option><option>Min</option><option>Max</option></select></label>`;['rowSel','valSel','aggSel'].forEach(id=>document.getElementById(id).onchange=pivot);}function pivot(){const rowH=document.getElementById('rowSel').value;const valH=document.getElementById('valSel').value;const agg=document.getElementById('aggSel').value;const ri=HEADERS.indexOf(rowH),vi=HEADERS.indexOf(valH);const groups={};CSV_DATA.forEach(r=>{const k=r[ri];const v=parseFloat(r[vi]);if(!isNaN(v)){if(!groups[k])groups[k]=[];groups[k].push(v);}});const rows=Object.entries(groups).map(([k,vals])=>{let result;switch(agg){case'Sum':result=vals.reduce((a,b)=>a+b,0);break;case'Average':result=vals.reduce((a,b)=>a+b,0)/vals.length;break;case'Count':result=vals.length;break;case'Min':result=Math.min(...vals);break;case'Max':result=Math.max(...vals);break;}return{label:k,value:result,count:vals.length};}).sort((a,b)=>b.value-a.value);const total=rows.reduce((s,r)=>s+r.value,0);const el=document.getElementById('table');el.innerHTML=`<tr><th>${rowH}</th><th style="text-align:right">${agg} of ${valH}</th><th style="text-align:right">Count</th></tr>`+rows.map(r=>`<tr><td>${r.label}</td><td class="num">${r.value.toFixed(2)}</td><td class="num">${r.count}</td></tr>`).join('')+`<tr class="total"><td>Total</td><td class="num">${total.toFixed(2)}</td><td class="num">${CSV_DATA.length}</td></tr>`;}const data=document.body.getAttribute('data-csv')||window.__SOURCE_CSV__||'';if(data){parse(data);buildControls();pivot();}else document.body.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px">No data.</p>';</script></body></html>'''

_SLIDES_HTML = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#1e293b;display:flex;flex-direction:column;height:100vh}.slide-container{flex:1;display:flex;align-items:center;justify-content:center;padding:40px}.slide{background:white;max-width:900px;width:100%;min-height:500px;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.3);padding:60px 80px;display:flex;flex-direction:column;justify-content:center}.slide h1{font-size:36px;color:#1e293b;margin-bottom:16px}.slide h2{font-size:28px;color:#3b82f6;margin-bottom:12px}.slide h3{font-size:22px;color:#475569;margin-bottom:8px}.slide p{font-size:18px;color:#475569;line-height:1.6;margin-bottom:8px}.slide ul,.slide ol{margin-left:24px;margin-bottom:8px}.slide li{font-size:18px;color:#475569;line-height:1.8}.slide code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:16px}.slide pre{background:#f1f5f9;padding:16px;border-radius:8px;margin:12px 0;overflow-x:auto}.controls{display:flex;align-items:center;justify-content:center;gap:16px;padding:16px;background:#0f172a}.controls button{padding:8px 20px;border:none;border-radius:8px;background:#3b82f6;color:white;font-size:14px;cursor:pointer}.controls button:hover{background:#2563eb}.controls button:disabled{opacity:0.3;cursor:default}.counter{color:#64748b;font-size:14px}</style></head><body><div class="slide-container"><div class="slide" id="slide"></div></div><div class="controls"><button id="prev" onclick="go(-1)">Previous</button><span class="counter" id="counter"></span><button id="next" onclick="go(1)">Next</button></div><script>let slides=[],current=0;function parseMarkdown(md){return md.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/^- (.+)$/gm,'<li>$1</li>').replace(/(<li>.*<\\/li>)/s,m=>'<ul>'+m+'</ul>').replace(/^(?!<[hluop])(\\S.+)$/gm,'<p>$1</p>');}function render(){document.getElementById('slide').innerHTML=parseMarkdown(slides[current]);document.getElementById('counter').textContent=`${current+1} / ${slides.length}`;document.getElementById('prev').disabled=current===0;document.getElementById('next').disabled=current===slides.length-1;}function go(d){current=Math.max(0,Math.min(slides.length-1,current+d));render();}document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' ')go(1);if(e.key==='ArrowLeft')go(-1);});const content=document.body.getAttribute('data-content')||window.__SOURCE_CONTENT__||'';if(content){slides=content.split(/^---$/m).map(s=>s.trim()).filter(Boolean);render();}else{document.getElementById('slide').innerHTML='<h1>Slide Deck</h1><p>Write markdown with --- separators between slides.</p>';}</script></body></html>'''

APP_TEMPLATES = [
    _app("app-timeline", "Timeline View", "git-commit", "visualization", _TIMELINE_HTML, 1, "Horizontal timeline for CSV data with date columns"),
    _app("app-pie-chart", "Pie Chart", "pie-chart", "visualization", _PIE_CHART_HTML, 2, "Pie/donut chart for categorical data distribution"),
    _app("app-bar-chart", "Bar Chart", "bar-chart-3", "visualization", _BAR_CHART_HTML, 3, "Grouped bar chart for CSV data"),
    _app("app-heatmap", "Heatmap", "grid-3x3", "visualization", _HEATMAP_HTML, 4, "Color-coded heatmap matrix for numerical data"),
    _app("app-gallery", "Card Gallery", "layout-grid", "display", _GALLERY_HTML, 5, "Responsive card grid showing each CSV row as a card"),
    _app("app-summary-stats", "Summary Stats", "calculator", "analysis", _SUMMARY_STATS_HTML, 6, "Dashboard showing count, avg, min, max for numerical columns"),
    _app("app-gantt", "Gantt Chart", "gantt-chart", "project", _GANTT_HTML, 7, "Project timeline with start/end dates and progress bars"),
    _app("app-treemap", "Treemap", "square", "visualization", _TREEMAP_HTML, 8, "Treemap for hierarchical/categorical data"),
    _app("app-pivot-table", "Pivot Table", "table-2", "analysis", _PIVOT_HTML, 9, "Interactive pivot table with row/column/value selectors"),
    _app("app-markdown-slides", "Slide Deck", "presentation", "display", _SLIDES_HTML, 10, "Convert markdown with --- separators into a slide presentation"),
]


def upgrade() -> None:
    op.create_table(
        "marketplace_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("item_type", sa.String(30), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("icon", sa.String(50), nullable=False, server_default="package"),
        sa.Column("category", sa.String(50), nullable=False, server_default="general"),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("is_builtin", sa.Boolean, server_default="true"),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("install_count", sa.Integer, server_default="0"),
        sa.Column("is_featured", sa.Boolean, server_default="false"),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Seed all built-in items
    marketplace_items = sa.table(
        "marketplace_items",
        sa.column("id", postgresql.UUID),
        sa.column("item_type", sa.String),
        sa.column("slug", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("icon", sa.String),
        sa.column("category", sa.String),
        sa.column("content", sa.Text),
        sa.column("is_builtin", sa.Boolean),
        sa.column("is_featured", sa.Boolean),
        sa.column("install_count", sa.Integer),
        sa.column("sort_order", sa.Integer),
    )

    all_items = COMMANDS + FILE_TEMPLATES + FOLDER_TEMPLATES + APP_TEMPLATES
    op.bulk_insert(marketplace_items, all_items)


def downgrade() -> None:
    op.drop_table("marketplace_items")
