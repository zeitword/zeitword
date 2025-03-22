# Contributing to Zeitword

Thank you for your interest in contributing to Zeitword! We aim to make the contribution process simple and straightforward.

## Getting Started

1. **Fork the repository**
   - Visit [Zeitword repository](https://github.com/zeitword/zeitword)
   - Click the "Fork" button in the top right
   - Clone your fork locally:
     ```bash
     git clone https://github.com/YOUR-USERNAME/zeitword.git
     cd zeitword
     ```
   - Add upstream remote:
     ```bash
     git remote add upstream https://github.com/zeitword/zeitword.git
     ```

2. **Set up your development environment**
   ```bash
   # Install dependencies
   bun i

   # Set up environment variables
   cp .env.example .env

   # Start local services
   docker compose up -d

   # Start development server
   bun dev
   ```

## Making Changes

1. Create a new branch for your changes
   ```bash
   git checkout -b feature/your-feature
   ```

2. Make your changes and test them locally

3. Commit your changes using clear commit messages
   ```bash
   git commit -m "Add new feature"
   ```

4. Keep your fork up to date
   ```bash
   git fetch upstream
   git merge upstream/main
   ```

## Pull Request Process

1. Push changes to your fork
   ```bash
   git push origin feature/your-feature
   ```

2. Visit your fork on GitHub and create a Pull Request
3. Create a PR with a clear description of your changes
4. Wait for review and address any feedback

## Need Help?

If you have questions or need help, please:
- Open an issue
- Comment on the relevant issue or PR

## License

By contributing to Zeitword, you agree that your contributions will be licensed under its MIT License.
