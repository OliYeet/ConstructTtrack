# 🔄 ConstructTrack Notion Sync

Bidirectional synchronization between your Notion database and local project files.

## 🌟 Features

### **Real-time Sync**

- **Notion → Local**: Instant updates when you change anything in Notion
- **Local → Notion**: Automatic sync when you edit local markdown files
- **Conflict Resolution**: Smart handling of simultaneous changes

### **File Management**

- **Automatic Backups**: Creates timestamped backups before overwriting
- **Status Tracking**: Generates `project-status.json` with progress metrics
- **Team Assignments**: Creates `team-assignments.json` for resource planning

### **Developer Experience**

- **File Watching**: Monitors local files for changes
- **Health Monitoring**: `/health` endpoint for service status
- **Webhook Security**: Optional signature verification
- **Error Handling**: Comprehensive logging and error recovery

## 🚀 Quick Start

### 1. Setup

```bash
# Install dependencies
npm install express

# Run setup wizard
npm run notion:sync:setup

# Edit .env file with your credentials
cp .env.example .env
```

### 2. Configure Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create or select your integration
3. Add webhook URL: `http://localhost:3001/webhook`
4. Subscribe to events: `page.updated`, `page.created`, `page.deleted`
5. Copy your integration token to `.env`

### 3. Start Sync Service

```bash
# Production mode
npm run notion:sync

# Development mode (with detailed logging)
npm run notion:sync:dev
```

## 📋 Environment Variables

```env
# Required
NOTION_TOKEN=secret_your_integration_token
NOTION_DATABASE_ID=your_database_id

# Optional
NOTION_WEBHOOK_SECRET=your_webhook_secret
SYNC_PORT=3001
NODE_ENV=development
```

## 🔄 How It Works

### **Notion → Local Sync**

1. Notion sends webhook when database changes
2. Service fetches updated data from Notion API
3. Generates new markdown file with all changes
4. Creates backup of existing file
5. Updates local files with new content

### **Local → Notion Sync**

1. File watcher detects changes to local markdown
2. Parses updated markdown content
3. Updates corresponding Notion database entries
4. Maintains parent-child relationships (Epic → Story → Task)

### **Generated Files**

- `docs/constructtrack_agile_project_plan.md` - Main project plan (synced)
- `docs/project-status.json` - Progress metrics and statistics
- `docs/team-assignments.json` - Team member assignments
- `*.backup.*` - Automatic backups with timestamps

## 🛠️ API Endpoints

### **Webhook Endpoint**

```
POST /webhook
```

Receives Notion database change notifications.

### **Health Check**

```
GET /health
```

Returns service status and last sync time.

```json
{
  "status": "healthy",
  "lastSync": "2024-01-15T10:30:00.000Z",
  "syncInProgress": false
}
```

## 📊 Use Cases

### **Project Management**

- Update task status in Notion → Local files reflect changes
- Add new epics/stories in markdown → Notion database updates
- Team assignments sync automatically

### **Documentation**

- Keep project documentation in sync across platforms
- Generate status reports from Notion data
- Maintain version history with automatic backups

### **Collaboration**

- Team members can work in Notion or local files
- Changes propagate automatically
- No manual export/import needed

## 🔧 Advanced Configuration

### **Webhook Security**

Set `NOTION_WEBHOOK_SECRET` to verify webhook signatures:

```env
NOTION_WEBHOOK_SECRET=your_secret_key
```

### **Custom Port**

Change the sync service port:

```env
SYNC_PORT=8080
```

### **Development Mode**

Enable detailed logging:

```bash
NODE_ENV=development npm run notion:sync
```

## 🐛 Troubleshooting

### **Common Issues**

**Webhook not receiving events:**

- Check Notion integration webhook URL
- Ensure service is running on correct port
- Verify firewall/network settings

**Sync conflicts:**

- Check logs for error messages
- Verify database permissions
- Ensure proper parent-child relationships

**File watching not working:**

- Check file permissions
- Verify file paths exist
- Restart sync service

### **Debugging**

```bash
# Check service status
curl http://localhost:3001/health

# View logs in development mode
NODE_ENV=development npm run notion:sync

# Test webhook manually
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"page_updated","data":{}}'
```

## 🚀 Production Deployment

### **Using ngrok (Development)**

```bash
# Install ngrok
npm install -g ngrok

# Expose local service
ngrok http 3001

# Use ngrok URL in Notion webhook settings
```

### **Production Server**

1. Deploy sync service to your server
2. Configure reverse proxy (nginx/Apache)
3. Set up SSL certificate
4. Update Notion webhook URL to your domain
5. Set production environment variables

## 📈 Monitoring

The sync service provides comprehensive logging:

- **Info**: Successful sync operations
- **Warning**: Non-critical issues (missing properties, etc.)
- **Error**: Failed operations with stack traces
- **Debug**: Detailed operation logs (development mode)

Monitor the `/health` endpoint for service status and integrate with your monitoring stack.

## 🤝 Contributing

To extend the sync functionality:

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit pull request

## 📄 License

This sync service is part of the ConstructTrack project and follows the same license terms.
