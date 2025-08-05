# Contributing to VendaBoost

Thank you for your interest in contributing to VendaBoost! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Git
- Chrome/Edge browser for testing
- Basic knowledge of JavaScript, HTML, CSS
- Familiarity with browser extensions (helpful)

### Development Setup
1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/VendaBoost.git
   cd VendaBoost
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Initialize authentication system**
   ```bash
   npm run setup:auth
   ```

4. **Start development**
   ```bash
   # Terminal 1: Extension development
   npm run dev
   
   # Terminal 2: Authentication server
   npm run start:auth
   ```

## 📝 Development Guidelines

### Code Style
- Use **consistent indentation** (2 spaces)
- Follow **camelCase** for variables and functions
- Use **meaningful variable names**
- Add **comments** for complex logic
- Keep **functions small** and focused

### Project Structure
```
VendaBoost/
├── src/                 # Extension source code
├── login-system/        # Authentication server
├── docs/               # Documentation
└── package.json        # Main dependencies
```

### Git Workflow
1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Test your changes thoroughly
   - Update documentation if needed

3. **Commit with meaningful messages**
   ```bash
   git commit -m "feat: add new marketplace posting feature"
   ```

4. **Push and create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format
Use conventional commits:
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting, missing semicolons
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance tasks

## 🧪 Testing

### Manual Testing Checklist
Before submitting a PR, ensure:
- [ ] Extension loads without errors
- [ ] Authentication flow works
- [ ] All existing features still work
- [ ] No console errors in browser dev tools
- [ ] Code follows project style guidelines

### Browser Testing
Test your changes in:
- [ ] Chrome (latest)
- [ ] Edge (latest)
- [ ] Firefox (if applicable)

## 🐛 Bug Reports

### Before Reporting
1. **Search existing issues** to avoid duplicates
2. **Test with latest version** of the extension
3. **Clear browser cache** and try again

### Bug Report Template
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- Browser: [e.g. Chrome 91]
- Extension Version: [e.g. 1.2.4]
- OS: [e.g. Windows 10]
```

## 💡 Feature Requests

### Before Requesting
1. **Check existing issues** and discussions
2. **Consider the scope** - does it fit the project goals?
3. **Think about implementation** - is it technically feasible?

### Feature Request Template
```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions you've thought about.

**Additional context**
Any other context, mockups, or examples.
```

## 🔧 Areas for Contribution

### High Priority
- [ ] **Security improvements** for authentication
- [ ] **Performance optimizations** for content scripts
- [ ] **Error handling** and user feedback
- [ ] **Test coverage** improvements

### Medium Priority
- [ ] **UI/UX enhancements** for popup interface
- [ ] **Additional marketplace features**
- [ ] **Documentation improvements**
- [ ] **Accessibility features**

### Low Priority
- [ ] **Code refactoring** for maintainability
- [ ] **Build system optimizations**
- [ ] **Developer tooling** improvements

## 📚 Development Resources

### Useful Links
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Express.js Documentation](https://expressjs.com/)
- [Vite Documentation](https://vitejs.dev/)
- [IndexedDB with Dexie.js](https://dexie.org/)

### Project-Specific Documentation
- [Project Structure](docs/STRUCTURE.md)
- [Authentication System](docs/LOGIN_SYSTEM.md)
- [Main README](README.md)

## 🤝 Community Guidelines

### Be Respectful
- Use welcoming and inclusive language
- Respect differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what's best for the community

### Be Collaborative
- Help others learn and grow
- Share knowledge and resources
- Provide constructive feedback
- Support fellow contributors

## 📞 Getting Help

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Code Reviews**: Feedback on Pull Requests

### Response Times
- **Bug reports**: We aim to respond within 48 hours
- **Feature requests**: We aim to respond within 1 week
- **Pull requests**: We aim to review within 1 week

## 🎯 Contribution Recognition

### Types of Contributions
We value all types of contributions:
- 🐛 **Bug fixes**
- ✨ **New features**
- 📝 **Documentation**
- 🧪 **Testing**
- 🎨 **Design improvements**
- 💡 **Ideas and suggestions**

### Recognition
- Contributors will be acknowledged in release notes
- Significant contributions will be highlighted in README
- All contributors are welcome to add themselves to CONTRIBUTORS.md

## 📋 Pull Request Process

### Before Submitting
1. **Update documentation** if needed
2. **Test thoroughly** in multiple browsers
3. **Follow coding standards**
4. **Squash commits** if necessary

### PR Template
```markdown
**Description**
Brief description of changes.

**Type of Change**
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

**Testing**
- [ ] Manual testing completed
- [ ] No console errors
- [ ] Extension loads properly

**Screenshots** (if applicable)
Add screenshots of UI changes.
```

### Review Process
1. **Automated checks** must pass
2. **Code review** by maintainers
3. **Testing** by reviewers
4. **Merge** after approval

Thank you for contributing to VendaBoost! 🚀
