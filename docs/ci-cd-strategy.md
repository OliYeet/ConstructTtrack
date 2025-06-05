# 🔄 CI/CD Strategy & Branch Management

## 📋 Branch Strategy

### **Main Branches**

- **`main`** - Production-ready code, protected branch
- **`develop`** - Integration branch for features, staging environment

### **Supporting Branches**

- **`feature/*`** - New features (e.g., `feature/lum-586-protocols`)
- **`hotfix/*`** - Critical production fixes
- **`bugfix/*`** - Non-critical bug fixes
- **`release/*`** - Release preparation branches

## 🚀 CI/CD Pipeline Triggers

### **Automatic Triggers**

| Branch Pattern | Push                           | Pull Request                   | Deployment           |
| -------------- | ------------------------------ | ------------------------------ | -------------------- |
| `main`         | ✅ Full CI + Production Deploy | ❌                             | 🚀 Production        |
| `develop`      | ✅ Full CI + Staging Deploy    | ✅ to `main`                   | 🧪 Staging           |
| `feature/*`    | ✅ Development CI              | ✅ to `develop` or `feature/*` | 📦 Preview           |
| `hotfix/*`     | ✅ Full CI                     | ✅ to `main`                   | 🔥 Hotfix Deploy     |
| `bugfix/*`     | ✅ Development CI              | ✅ to `develop`                | 🐛 Preview           |
| `release/*`    | ✅ Full CI                     | ✅ to `main`                   | 🎯 Release Candidate |

### **Manual Triggers**

- **`workflow_dispatch`** - Manual trigger for any branch
- **Repository dispatch** - External API triggers

## 🔧 Workflow Configuration

### **Main CI Pipeline** (`ci.yml`)

```yaml
on:
  push:
    branches: [main, develop, 'feature/*']
  pull_request:
    branches: [main, develop, 'feature/*']
```

**Jobs:**

1. 🔍 **Quality** - Linting, formatting, security, type checking
2. 🧪 **Tests** - Unit, integration, e2e tests
3. 🏗️ **Build** - Application build + preview deployment
4. 🚀 **Deploy** - Production deployment (main only)
5. 🗄️ **Migrate** - Database migrations (main only)
6. 📊 **Monitor** - Performance & security monitoring

### **Development Pipeline** (`development.yml`)

```yaml
on:
  push:
    branches: [develop, 'feature/*', 'hotfix/*', 'bugfix/*']
  pull_request:
    branches: [develop, 'feature/*']
```

**Jobs:**

1. 🚀 **Quick Checks** - Fast linting, formatting, type checking
2. 🏗️ **Dev Build** - Development build (continue-on-error)
3. 📊 **Quality Analysis** - Code quality metrics
4. 🔗 **Integration Tests** - Integration and e2e tests

## 🎯 Best Practices

### **Feature Branch Workflow**

1. Create feature branch: `git checkout -b feature/lum-xxx-description`
2. Push triggers development CI automatically
3. Create PR to integration branch or `develop`
4. CI runs automatically - no manual configuration needed
5. Merge after CI passes and code review

### **Integration Branch Strategy**

- Use integration branches like `feature/lum-582-realtime` for complex features
- CI automatically runs for PRs between feature branches
- No need to modify workflows for new branches

### **Hotfix Workflow**

1. Create hotfix branch: `git checkout -b hotfix/critical-fix`
2. CI runs automatically
3. Create PR directly to `main` for critical fixes
4. Automatic production deployment after merge

## 🔒 Branch Protection Rules

### **`main` Branch**

- ✅ Require PR reviews (2 reviewers)
- ✅ Require status checks to pass
- ✅ Require up-to-date branches
- ✅ Restrict pushes to admins only
- ✅ Require signed commits

### **`develop` Branch**

- ✅ Require PR reviews (1 reviewer)
- ✅ Require status checks to pass
- ✅ Allow force pushes for maintainers

### **Feature Branches**

- ✅ Require status checks to pass
- ✅ Delete branch after merge

## 🚨 Emergency Procedures

### **Bypass CI (Emergency Only)**

```bash
git push --no-verify  # Skip pre-commit hooks
git commit --no-verify  # Skip commit hooks
```

### **Manual Deployment**

```bash
# Trigger manual deployment
gh workflow run ci.yml --ref main
```

## 📊 Monitoring & Alerts

- **Sentry** - Error tracking and performance monitoring
- **Vercel** - Deployment status and preview URLs
- **GitHub Actions** - CI/CD pipeline status
- **CodeCov** - Test coverage reporting

## 🔄 Future Enhancements

- **Semantic Release** - Automated versioning and changelog
- **Dependabot** - Automated dependency updates
- **Security Scanning** - Advanced security analysis
- **Performance Budgets** - Automated performance regression detection
