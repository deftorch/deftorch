# Contributing to Genesis

First off, thank you for considering contributing to Genesis! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)
- [Commit Messages](#commit-messages)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

### Our Standards

- **Be respectful** and considerate
- **Be collaborative** and helpful
- **Be inclusive** and welcoming
- **Focus on what is best** for the community

## 🤔 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the bug
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details** (OS, Node version, browser)

### Suggesting Features

Feature suggestions are welcome! Please:

- **Use a clear title** and description
- **Explain why** this feature would be useful
- **Provide examples** of how it would work
- **Check** if it's already been suggested

### Code Contributions

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

## 🛠️ Development Setup

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/chat-bot-nextjs.git
cd chat-bot-nextjs

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Add your API keys to .env.local

# Start development server
npm run dev
```

### Project Structure

```
genesis/
├── app/            # Next.js app directory
├── components/     # React components
├── config/         # Configuration
├── hooks/          # Custom hooks
├── lib/            # Utilities & stores
├── types/          # TypeScript types
└── public/         # Static assets
```

## 🔄 Pull Request Process

### Before Submitting

1. **Update** documentation if needed
2. **Test** your changes thoroughly
3. **Follow** coding guidelines
4. **Lint** your code: `npm run lint`
5. **Build** successfully: `npm run build`

### PR Guidelines

- **One feature** per pull request
- **Clear title** describing the change
- **Detailed description** of what and why
- **Reference issues** if applicable
- **Add screenshots** for UI changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added new tests
- [ ] All tests pass

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings
```

## 💻 Coding Guidelines

### TypeScript

- Use **TypeScript** for all new files
- Define **proper types** and interfaces
- Avoid `any` type when possible
- Use **type inference** where appropriate

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

const user: User = {
  id: '123',
  name: 'John',
  email: 'john@example.com'
};

// ❌ Bad
const user: any = {
  id: '123',
  name: 'John'
};
```

### React Components

- Use **functional components** with hooks
- Proper **prop typing**
- Extract **reusable logic** into hooks
- Use **memo** for expensive components

```typescript
// ✅ Good
interface Props {
  title: string;
  onClick: () => void;
}

export const Button: React.FC<Props> = ({ title, onClick }) => {
  return <button onClick={onClick}>{title}</button>;
};

// ❌ Bad
export const Button = (props: any) => {
  return <button onClick={props.onClick}>{props.title}</button>;
};
```

### Styling

- Use **Tailwind CSS** utilities
- Follow **responsive design** principles
- Use **CSS variables** for theming
- Consistent **spacing** and **sizing**

```tsx
// ✅ Good
<div className="flex items-center gap-2 p-4 rounded-lg bg-card">
  <Icon className="h-5 w-5" />
  <span className="text-sm font-medium">Text</span>
</div>

// ❌ Bad
<div style={{ display: 'flex', padding: '16px' }}>
  <Icon style={{ width: '20px' }} />
  <span>Text</span>
</div>
```

### File Naming

- **Components**: PascalCase (e.g., `ChatMessage.tsx`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `useChat.ts`)
- **Constants**: UPPER_SNAKE_CASE

### Code Organization

- **Group** related code
- **One component** per file
- **Export** at the bottom
- **Import order**: external → internal → relative

```typescript
// External imports
import React from 'react';
import { useRouter } from 'next/navigation';

// Internal imports
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store/chat-store';

// Relative imports
import { ChatInput } from './ChatInput';
```

## 📝 Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

### Examples

```bash
# Good commits
feat(chat): add message editing functionality
fix(api): resolve NekoLabs API response parsing
docs(readme): update installation instructions
style(ui): improve button hover effects
refactor(hooks): extract chat logic to custom hook

# Bad commits
update stuff
fix bug
changes
wip
```

### Best Practices

- Use **present tense** ("add" not "added")
- Use **imperative mood** ("move" not "moves")
- Keep **subject line** under 50 characters
- Capitalize **subject line**
- No period at the end of **subject**
- Separate **subject** from **body** with blank line
- Explain **what** and **why**, not how

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests

- Test **user interactions**
- Test **edge cases**
- Test **error handling**
- Keep tests **simple** and **readable**

```typescript
// Example test
describe('ChatMessage', () => {
  it('renders message content', () => {
    const message = { id: '1', content: 'Hello', role: 'user' };
    render(<ChatMessage message={message} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', () => {
    const onEdit = jest.fn();
    const message = { id: '1', content: 'Hello', role: 'user' };
    render(<ChatMessage message={message} onEdit={onEdit} />);
    fireEvent.click(screen.getByTitle('Edit message'));
    expect(onEdit).toHaveBeenCalledWith('1', 'Hello');
  });
});
```

## 📚 Documentation

### Code Comments

- Comment **why**, not what
- Use **JSDoc** for functions
- Keep comments **up to date**

```typescript
/**
 * Generates a unique ID for messages
 * Uses timestamp + random number to ensure uniqueness
 * @returns {string} Unique identifier
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
```

### README Updates

Update README.md when:
- Adding new **features**
- Changing **installation steps**
- Adding new **dependencies**
- Updating **configuration**

## 🎯 Areas for Contribution

### High Priority

- [ ] Bug fixes
- [ ] Performance improvements
- [ ] Accessibility improvements
- [ ] Mobile responsiveness
- [ ] Test coverage

### Medium Priority

- [ ] New AI model integrations
- [ ] UI/UX enhancements
- [ ] Documentation improvements
- [ ] Code refactoring

### Low Priority

- [ ] New features
- [ ] Experimental features
- [ ] Code style improvements

## ❓ Questions?

- Check [documentation](./docs)
- Search [existing issues](https://github.com/firdausmntp/chat-bot-nextjs/issues)
- Ask in [discussions](https://github.com/firdausmntp/chat-bot-nextjs/discussions)
- Contact maintainers

## 🙏 Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort!

---

**Happy Contributing! 🚀**
