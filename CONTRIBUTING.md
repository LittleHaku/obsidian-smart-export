# Contributing to Smart Export

Thank you for your interest in contributing to Smart Export. This document provides guidelines and information for contributors to help maintain code quality and ensure a smooth development process.

## How to Contribute

We welcome contributions of all types:

- 🐛 **Bug Reports** - Help identify and resolve issues
- ✨ **Feature Requests** - Suggest new functionality and improvements
- 💻 **Code Contributions** - Submit bug fixes or new features
- 📚 **Documentation** - Improve guides, examples, and explanations
- 🧪 **Testing** - Help test new features or edge cases
- 💡 **Ideas & Discussion** - Share thoughts on improvements and direction

## Getting Started

### Prerequisites

- **Node.js** 18+ and **pnpm** (npm will also work)
- **Obsidian** (for testing your changes)
- **Git** for version control

### Development Setup

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/LittleHaku/obsidian-smart-export.git
   cd smart-export
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   ```

4. **Start development mode**:

   ```bash
   pnpm run dev
   ```

5. **Link to Obsidian** for testing:

   - Clone your fork into your test vault's `.obsidian/plugins/` directory:

     ```bash
     # Inside your test vault
     cd .obsidian/plugins
     git clone https://github.com/<your-username>/smart-export.git smart-export
     ```

   Then reload Obsidian and enable the plugin.

### Development Workflow

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards below

3. **Test your changes**:

   ```bash
   pnpm test                # Run all tests
   pnpm run lint            # Check code style
   pnpm run format:check    # Check formatting
   ```

4. **Commit your changes**:

   ```bash
   git add .
   git commit -m "feat: your descriptive commit message"
   ```

5. **Push and create a pull request**:
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Standards

### TypeScript and Code Style

- **Strict TypeScript**: We use strict mode to ensure type safety and catch potential issues early
- **ESLint**: Follow the established linting rules to maintain code consistency
- **Prettier**: Code is automatically formatted to ensure consistent style
- **Naming Conventions**: Use camelCase for variables and functions, PascalCase for classes and interfaces

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/) to maintain a clear and organized commit history:

```
type(scope): description

Examples:
feat: add vault context functionality
fix: resolve circular reference in BFS traversal
docs: update installation instructions
test: add unit tests for XML exporter
refactor: improve token calculation performance
```

**Types:**

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

### Testing Requirements

- **Unit tests** for all new functionality (we use Vitest)
- **Integration tests** for complex features
- **Manual testing** in Obsidian
- **Maintain 80%+ code coverage**

```bash
pnpm test              # Run tests with coverage
pnpm run test:watch    # Watch mode for development
```

## Testing Guidelines

### Writing Tests

- Use **Vitest** for unit testing
- Place test files in the `tests/` directory
- Follow established patterns in existing tests
- Mock Obsidian API calls using provided helpers

### Test Categories

1. **Unit tests**: Test individual functions and classes
2. **Integration tests**: Test component interactions and workflows
3. **Edge cases**: Test error conditions and boundary cases

### Manual Testing Checklist

When testing UI changes, ensure you've covered:

- [ ] Different vault sizes and structures
- [ ] Various note linking patterns
- [ ] All export formats and options
- [ ] Error scenarios and edge cases
- [ ] Cross-platform compatibility

## Documentation Standards

### Code Documentation

- **JSDoc comments** for all public methods and classes
- **Inline comments** for complex logic and algorithms
- **README updates** for new features and changes
- **CHANGELOG entries** for all user-facing changes

### User Documentation

- Update **README.md** when adding new features
- Include **examples** for complex functionality
- Add **screenshots** for UI changes
- Update **troubleshooting** sections as needed

## Reporting Issues

When reporting bugs, please include:

1. **Clear description** of the issue and expected behavior
2. **Reproduction steps** with specific details
3. **Environment information** (OS, Obsidian version, plugin version)
4. **Error messages** or console output
5. **Vault information** if relevant to the issue

Use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml) to ensure all necessary information is provided.

## Feature Requests

When suggesting new features:

1. **Describe the problem** you're trying to solve
2. **Explain your proposed solution** and how it would work
3. **Consider alternatives** and explain why your approach is best
4. **Ensure alignment** with the plugin's core purpose

Use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml) to structure your proposal.

## Code Review Process

### For Contributors

1. **Self-review** your code before submitting
2. **Test thoroughly** including edge cases
3. **Update documentation** as needed
4. **Follow the PR template** completely
5. **Respond promptly** to feedback and questions

### Review Criteria

Pull requests are evaluated on:

- **Code quality** and adherence to standards
- **Test coverage** and quality
- **Documentation** completeness
- **User experience** impact
- **Performance** considerations
- **Backwards compatibility**

## Architecture Guidelines

### Core Principles

- **Modularity**: Keep components focused and testable
- **TypeScript**: Leverage strong typing for reliability
- **Performance**: Consider impact on large vaults
- **User Experience**: Prioritize intuitive and efficient workflows

### Code Organization

- **Single responsibility**: Each function/class should have a clear, focused purpose
- **Clear interfaces**: Design APIs that are easy to understand and use
- **Error handling**: Implement graceful error handling for edge cases
- **Testing**: Write tests alongside code development

## Getting Help

### Questions and Support

- **General questions**: [GitHub Discussions](https://github.com/LittleHaku/smart-export/discussions)
- **Bug reports**: [GitHub Issues](https://github.com/LittleHaku/smart-export/issues)
- **Feature requests**: [GitHub Issues](https://github.com/LittleHaku/smart-export/issues)

### Development Resources

- Review existing code to understand the architecture
- Examine recent pull requests to understand the process
- Don't hesitate to ask questions in discussions or issues

---

Thank you for contributing to Smart Export. Your contributions help make this plugin better for the entire Obsidian community.
