# Release Process

This document describes the release process for jsapdu packages.

## Overview

jsapdu uses [Changesets](https://github.com/changesets/changesets) for version management and release automation. Packages are published to **GitHub Packages** (not npmjs).

## Release Workflow

### 1. Making Changes

When you make changes that should be included in the next release:

1. Create your feature branch and make your changes
2. Run the tests to ensure everything works:
   ```bash
   npm run build
   npm run lint
   npm run test
   ```

3. Create a changeset describing your changes:
   ```bash
   npm run changeset
   ```

4. Follow the prompts:
   - Select which packages are affected
   - Choose the version bump type (major, minor, patch)
   - Write a clear description of the changes

5. Commit the changeset file along with your changes:
   ```bash
   git add .changeset/your-changeset-file.md
   git commit -m "feat: add new feature with changeset"
   ```

6. Push your branch and create a Pull Request

### 2. Version Bump Types

- **Major (breaking)**: Breaking changes that require users to update their code
- **Minor (feature)**: New features that are backward compatible
- **Patch (fix)**: Bug fixes and minor improvements

### 3. Release Process

The release process is automated via GitHub Actions:

1. **When PR is merged to `main`**:
   - The `release.yml` workflow runs automatically
   - It collects all changesets since the last release
   - Creates a "Version Packages" PR with:
     - Updated version numbers in package.json files
     - Updated CHANGELOG.md files
     - Removal of consumed changeset files

2. **Review the Version Packages PR**:
   - Review the version bumps and changelog entries
   - Ensure all changes are correctly documented
   - Get approval from maintainers

3. **Merge the Version Packages PR**:
   - When merged, the workflow automatically:
     - Builds all packages
     - Runs lint and tests
     - Publishes packages to GitHub Packages
     - Creates git tags for each released version

### 4. GitHub Packages Configuration

Packages are published to GitHub Packages with the `@aokiapp` scope.

To install packages from GitHub Packages, users need to configure their `.npmrc`:

```
@aokiapp:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Or configure via npm:
```bash
npm config set @aokiapp:registry https://npm.pkg.github.com
```

### 5. Manual Release (Emergency)

If you need to release manually:

```bash
# Ensure you're on main branch with latest changes
git checkout main
git pull

# Build all packages
npm run build

# Run tests
npm run test

# Create version bump (if not using changesets)
npm run version

# Publish (requires GitHub token)
NODE_AUTH_TOKEN=<your_github_token> npm run release
```

## CI/CD Workflows

### CI Workflow (`.github/workflows/ci.yml`)
- Runs on all pushes and pull requests
- Builds, lints, and tests all packages
- Creates and uploads package artifacts

### Release Workflow (`.github/workflows/release.yml`)
- Runs only on pushes to `main`
- Manages version bumps and releases
- Publishes to GitHub Packages

## Package Configuration

All publishable packages have:
- `publishConfig.registry` set to `https://npm.pkg.github.com`
- Proper `repository` field pointing to the monorepo
- `files` field specifying what to publish

## Examples

### Adding a New Feature

```bash
# Make your changes
# ...

# Create changeset
npm run changeset
# Select affected packages: @aokiapp/jsapdu-pcsc
# Version bump: minor
# Description: "Add support for card insertion events"

# Commit
git add .
git commit -m "feat: add card insertion event support"
git push
```

### Fixing a Bug

```bash
# Fix the bug
# ...

# Create changeset
npm run changeset
# Select affected packages: @aokiapp/apdu-utils
# Version bump: patch
# Description: "Fix incorrect status word parsing"

# Commit
git add .
git commit -m "fix: correct status word parsing in apdu-utils"
git push
```

### Breaking Change

```bash
# Make breaking change
# ...

# Create changeset
npm run changeset
# Select affected packages: @aokiapp/jsapdu-interface
# Version bump: major
# Description: "BREAKING: Change CommandApdu constructor signature"

# Commit
git add .
git commit -m "feat!: update CommandApdu API (breaking change)"
git push
```

## Troubleshooting

### Release workflow failed
- Check the GitHub Actions logs
- Ensure all tests pass
- Verify GitHub token has correct permissions (packages:write)

### Package version conflicts
- Run `npm run version` to resolve conflicts
- Review package-lock.json changes
- Re-run tests after resolution

### Publishing permission denied
- Verify the GitHub token has `packages:write` permission
- Check repository package settings allow workflow publishing
- Ensure the package scope matches the organization

## Related Documentation

- [Changesets Documentation](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md)
- [GitHub Packages Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [Turbo Documentation](https://turbo.build/repo/docs)
