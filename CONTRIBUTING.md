<div align="center">
  
  <img src="https://capsule-render.vercel.app/api?type=waving&height=200&color=gradient&text=Contributing%20Guide&fontAlignY=30&fontSize=50&desc=Help%20Us%20Improve%20AnimePaheAPI&descSize=20" />

</div>

# Contributing to AnimePaheAPI

Thank you for your interest in contributing to **AnimePaheAPI**! This document provides guidelines and instructions to help you get started.

> 🎯 **First-time contributor?** Look for issues labeled [`good first issue`](https://github.com/Shineii86/AnimePaheAPI/labels/good%20first%20issue) or [`help wanted`](https://github.com/Shineii86/AnimePaheAPI/labels/help%20wanted).

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [How Can I Contribute?](#-how-can-i-contribute)
- [Getting Started](#-getting-started)
- [Development Setup](#-development-setup)
- [Project Structure](#-project-structure)
- [Contributing Guidelines](#-contributing-guidelines)
- [Coding Standards](#-coding-standards)
- [Commit Messages](#-commit-messages)
- [Pull Request Process](#-pull-request-process)
- [Reporting Bugs](#-reporting-bugs)
- [Suggesting Features](#-suggesting-features)
- [Style Guide](#-style-guide)
- [Need Help?](#-need-help)

---

## 📜 Code of Conduct

By participating in this project, you agree to maintain a **respectful and inclusive** environment. Please:

- ✅ Be kind and constructive
- ✅ Welcome newcomers and help them learn
- ✅ Focus on what is best for the community
- ❌ No harassment, trolling, or toxic behavior
- ❌ No spam or off-topic discussions

---

## 🤝 How Can I Contribute?

### 🐛 Report Bugs

Found something broken? [Open an Issue](https://github.com/Shineii86/AnimePaheAPI/issues/new?template=bug_report.md) with:

- **Clear title** describing the bug
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Environment details** (Node.js version, OS, etc.)
- **Screenshots or logs** if applicable

### 💡 Suggest Features

Have an idea? [Start a Discussion](https://github.com/Shineii86/AnimePaheAPI/issues) with:

- **Problem statement** — What problem does this solve?
- **Proposed solution** — How would you implement it?
- **Alternatives considered** — Any other approaches?
- **Use cases** — Who benefits from this feature?

### 🔀 Submit Code Changes

Ready to contribute code?

1. **Fork** the repository
2. **Clone** your fork
3. **Create** a feature branch
4. **Make** your changes
5. **Test** thoroughly
6. **Submit** a pull request

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (`node -v`)
- **npm** 9+ (`npm -v`)
- **Git** (`git --version`)
- **Playwright** (for DDoS bypass testing)

### Quick Start

```bash
# 1. Fork the repo on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/AnimePaheAPI.git
cd AnimePaheAPI

# 3. Install dependencies
npm install

# 4. Install Playwright browsers
npx playwright install chromium

# 5. Start development server
npm run dev

# 6. Run tests
npm test
```

---

## 🛠️ Development Setup

### Environment Variables

Copy the example env file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
PORT=3000
BASE_URL=https://animepahe.ch
COOKIES=           # Optional: manual cookies
```

### Available Scripts

| Command | Description |
|:--------|:-----------|
| `npm start` | Start production server |
| `npm run dev` | Start dev server with auto-reload |
| `npm test` | Run test suite |
| `npm run lint` | Check code style |

---

## 📁 Project Structure

```
AnimePaheAPI/
├── api/                    # Vercel serverless functions
│   └── index.js
├── src/
│   ├── configs/            # Configuration files
│   │   ├── dataUrl.js      # URL patterns for animepahe.ch
│   │   └── header.config.js # HTTP headers
│   ├── extractors/         # HTML parsing logic
│   │   ├── home.extractor.js
│   │   ├── search.extractor.js
│   │   ├── info.extractor.js
│   │   ├── episodes.extractor.js
│   │   └── series.extractor.js
│   ├── helper/             # Utility functions
│   │   ├── cache.helper.js
│   │   └── error.helper.js
│   ├── models/             # Business logic
│   │   └── playModel.js    # Streaming extraction
│   ├── routes/             # Express routes
│   │   └── apiRoutes.js    # All API endpoints
│   ├── scrapers/           # Web scraping logic
│   │   └── animepahe.js    # Core scraper
│   └── utils/              # Utility modules
│       ├── browser.js      # Playwright launcher
│       ├── config.js       # App configuration
│       └── requestManager.js # HTTP client
├── public/                 # Static files
│   └── index.html          # Landing page
├── server.js               # Express entry point
├── package.json
└── README.md
```

---

## 📝 Contributing Guidelines

### Adding a New Endpoint

1. **Create/update extractor** in `src/extractors/`
2. **Add route** in `src/routes/apiRoutes.js`
3. **Update OpenAPI docs** in the `/api/docs` endpoint
4. **Add tests** for the new endpoint
5. **Update README** with documentation

### Adding a New Extractor

```javascript
// src/extractors/example.extractor.js

/**
 * Extracts data from the example page.
 *
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {Object} Extracted data
 */
function extractExample($) {
  const results = [];
  
  // Your extraction logic here
  
  return results;
}

module.exports = { extractExample };
```

### Adding a New Route

```javascript
// In src/routes/apiRoutes.js

// ---- FEATURE: Example endpoint ----
/**
 * GET /api/example
 * Description of the endpoint.
 */
router.get('/example', asyncHandler(async (req, res) => {
  const cacheKey = 'example';
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const $ = await fetchPage(URLS.example);
  const data = extractExample($);

  cache.set(cacheKey, data, CACHE_TTL.example);
  res.json({ success: true, results: data });
}));
```

---

## 🎨 Coding Standards

### Code Style

- **ES6+** features preferred
- **Single quotes** for strings
- **2 spaces** for indentation (no tabs)
- **Semicolons** required
- **Trailing commas** in arrays/objects

### Comments

- Use `// ---- FEATURE: Description ----` for feature markers
- Use JSDoc for all functions
- Keep comments concise and useful

### Naming Conventions

- **Files:** `kebab.case.js` (e.g., `home.extractor.js`)
- **Functions:** `camelCase` (e.g., `extractHome`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `BASE_URL`)
- **Classes:** `PascalCase` (e.g., `Animepahe`)

### Error Handling

```javascript
// ✅ Good
try {
  const data = await fetchSomething();
  return data;
} catch (error) {
  console.error('[Module] Error:', error.message);
  throw new CustomError('Failed to fetch', 503);
}

// ❌ Bad
try {
  return await fetchSomething();
} catch (e) {
  console.log(e);
}
```

---

## 💬 Commit Messages

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|:-----|:-----------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (no logic) |
| `refactor` | Code refactoring |
| `test` | Adding/updating tests |
| `chore` | Maintenance tasks |

### Examples

```bash
feat(api): add /api/airing endpoint
fix(scraper): handle DDoS-Guard timeout
docs(readme): update API endpoints section
refactor(extractors): simplify search parsing
test(api): add tests for /api/search
```

---

## 🔀 Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow format
- [ ] Branch is up-to-date with `main`

### PR Template

```markdown
## Description

Brief description of changes.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing

Describe tests you ran.

## Checklist

- [ ] Tests pass
- [ ] Docs updated
- [ ] No console errors
```

### Review Process

1. **Automated checks** must pass
2. **At least 1 review** required
3. **Resolve** all feedback
4. **Squash and merge** when approved

---

## 🐞 Reporting Bugs

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment**
- Node.js version: [e.g., 18.17.0]
- OS: [e.g., Ubuntu 22.04]
- npm version: [e.g., 9.6.7]

**Additional context**
Any other information about the problem.
```

---

## 💡 Suggesting Features

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other solutions you've thought about.

**Additional context**
Mockups, examples, or references.
```

---

## 🎨 Style Guide

### Indentation

```javascript
// ✅ 2 spaces
function example() {
  if (true) {
    return {
      key: 'value'
    };
  }
}

// ❌ Tabs or 4 spaces
function example() {
\tif (true) {
\t\treturn {
\t\t\tkey: 'value'
\t\t};
\t}
}
```

### Strings

```javascript
// ✅ Single quotes
const name = 'animepahe';

// ✅ Template literals for interpolation
const url = `${BASE_URL}/api`;

// ❌ Double quotes (except in JSON)
const name = "animepahe";
```

### Trailing Commas

```javascript
// ✅ Trailing commas
const array = [
  'one',
  'two',
  'three',
];

const object = {
  name: 'value',
  version: '1.0.0',
};

// ❌ No trailing commas
const array = ['one', 'two', 'three'];
```

---

## 🆘 Need Help?

- **GitHub Issues**: [Ask a question](https://github.com/Shineii86/AnimePaheAPI/issues)
- **Discussions**: [Join the conversation](https://github.com/Shineii86/AnimePaheAPI/discussions)

---

## 🙏 Thank You!

Every contribution helps make AnimePaheAPI better. Whether it's a bug report, feature suggestion, or code change — we appreciate your help!

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=100&color=gradient&text=Thank%20You!&fontAlignY=50&fontSize=30" />
</p>
