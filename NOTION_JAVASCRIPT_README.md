# ConstructTrack → Notion Importer (JavaScript/Node.js)

Import your complete ConstructTrack agile project plan into Notion using familiar npm commands!

## 🚀 Quick Start (3 commands)

```bash
# 1. Install dependencies (just like any npm project)
npm install

# 2. Setup configuration
npm run notion:setup

# 3. Import to Notion
npm run notion:import
```

## ✅ Why JavaScript/Node.js?

- **Familiar workflow**: Use npm like any other Node.js project
- **No virtual environments**: No Python complexity
- **Modern tooling**: ES modules, async/await, beautiful CLI output
- **Easy debugging**: Use `npm run notion:dev` for development mode

## 📦 What Gets Installed

```json
{
  "@notionhq/client": "^2.2.15",  // Official Notion API client
  "dotenv": "^16.3.1",            // Environment variable management
  "chalk": "^5.3.0",              // Beautiful colored console output
  "ora": "^7.0.1"                 // Elegant progress spinners
}
```

## 🛠️ Available Commands

```bash
# Setup (creates .env template and shows instructions)
npm run notion:setup

# Import agile plan to Notion
npm run notion:import

# Development mode (auto-restart on file changes)
npm run notion:dev
```

## 📋 Setup Process

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Notion Integration
1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"New integration"**
3. Name it: `ConstructTrack Importer`
4. Copy the **Integration Token** (starts with `secret_`)

### 3. Prepare Parent Page
1. Create a new page in Notion where you want the database
2. Share the page with your integration:
   - Click **"Share"** → **"Invite"**
   - Search for `ConstructTrack Importer` and invite it
3. Copy the **page ID** from the URL:
   - URL: `https://notion.so/Your-Page-Title-1234567890abcdef`
   - Page ID: `1234567890abcdef`

### 4. Configure Environment
```bash
# Run setup to create .env template
npm run notion:setup

# Edit .env file with your credentials
NOTION_TOKEN=secret_your_actual_token_here
NOTION_PARENT_PAGE_ID=your_actual_page_id_here
```

### 5. Import Your Project Plan
```bash
npm run notion:import
```

## 📊 What Gets Created

### Complete Notion Database
- **8 Epics** with priorities and timelines
- **16+ User Stories** with acceptance criteria
- **120+ Tasks** with role assignments
- **All Dependencies** mapped and tracked
- **Story Points** for sprint planning

### Database Properties
- **Title**: Epic/Story/Task name
- **Type**: Epic (purple), Story (blue), Task (green)
- **Epic**: Which epic this belongs to
- **Story**: Which story (for tasks)
- **Story Points**: Fibonacci estimates
- **Status**: Not Started → In Progress → Testing → Done
- **Priority**: P0 (Critical) through P3 (Low)
- **Team/Role**: Frontend, Backend, QA, etc.
- **Timeline**: Sprint/week assignments
- **Dependencies**: Blocking relationships
- **Description**: Full descriptions
- **Acceptance Criteria**: Success criteria

## 🎯 Example Output

```bash
🏗️  ConstructTrack Agile Project Plan → Notion Importer
============================================================

🔍 Checking prerequisites...
✅ Found docs/constructtrack_agile_project_plan.md
✅ Node.js v18.17.0 - compatible

📖 Parsing agile project plan...
✅ Parsed 8 epics successfully

🗄️  Creating Notion database...
✅ Created Notion database: 12345678-1234-1234-1234-123456789abc

⠋ Populating database with 144 items...
✅ Database population completed!

🎉 Success! Your ConstructTrack agile project plan has been imported to Notion.
Database ID: 12345678-1234-1234-1234-123456789abc
You can view it at: https://notion.so/123456781234123412341234567890abc
```

## 🔧 Configuration Options

### Environment Variables (.env)
```bash
# Required
NOTION_TOKEN=secret_your_token_here
NOTION_PARENT_PAGE_ID=your_page_id_here

# Optional
MARKDOWN_FILE=docs/constructtrack_agile_project_plan.md
NODE_ENV=development  # Shows detailed error messages
```

### Custom Markdown File
```bash
# Use a different markdown file
MARKDOWN_FILE=path/to/your/agile-plan.md
```

## 🐛 Troubleshooting

### Common Issues

**"Module not found" Error**
```bash
# Make sure dependencies are installed
npm install
```

**"Unauthorized" Error**
- Check your integration token is correct
- Ensure the parent page is shared with your integration

**"Page not found" Error**
- Verify the parent page ID is correct
- Make sure the page exists and is accessible

**"File not found" Error**
- Ensure `docs/constructtrack_agile_project_plan.md` exists
- Or set custom path with `MARKDOWN_FILE` environment variable

### Development Mode
```bash
# Run in development mode for detailed error messages
NODE_ENV=development npm run notion:import
```

## 🆚 JavaScript vs Python Version

| Feature | JavaScript | Python |
|---------|------------|--------|
| **Setup** | `npm install` | Virtual environment setup |
| **Dependencies** | Automatic isolation | Manual virtual environment |
| **Familiarity** | You already know npm | New ecosystem to learn |
| **Debugging** | Node.js tools you know | Python-specific tools |
| **Performance** | Fast startup | Slower startup |
| **Maintenance** | Part of your existing workflow | Separate Python environment |

## 🎉 Success!

Once complete, you'll have a fully functional Notion project management database with:

✅ **8 Epics** organized by priority and timeline  
✅ **16+ User Stories** with detailed acceptance criteria  
✅ **120+ Tasks** with clear role assignments  
✅ **Complete dependency mapping** for proper sequencing  
✅ **Story point estimates** ready for sprint planning  
✅ **Professional project management** setup in Notion  

Your team can immediately start using this for sprint planning, task assignment, and progress tracking!

## 📈 Next Steps

1. **Create Views**: Set up Kanban boards, sprint views, team dashboards
2. **Invite Team**: Add team members and assign tasks
3. **Start Planning**: Use story points and timelines for sprint planning
4. **Track Progress**: Update statuses and monitor completion
5. **Customize**: Add custom properties for your workflow

Happy project managing! 🚀
