# @kad-products/shed

Shared utilities, components, and classes for KAD Products projects.

---

## Local development

### 1. Start watch mode

In this repo:

```sh
pnpm dev
```

tsup will rebuild `dist/` on every file change.

### 2. Link to a consuming project

From the **consuming project's root**:

```sh
pnpm link /path/to/shed
```

pnpm resolves the symlink through the `exports` map, so imports like `@kad-products/shed/rwsdk/server` will hit the live `dist/` output. Because `pnpm dev` is rebuilding on save, changes show up on the next reload/restart of the consuming project — no re-link needed.

To unlink when you're done:

```sh
pnpm unlink @kad-products/shed
# then reinstall to restore the published version
pnpm install
```

> **Note:** `pnpm link` requires the `dist/` folder to exist. Run `pnpm build` at least once before linking if you haven't started `pnpm dev` yet.

---

## Usage

### Registry setup

This package is published to GitHub Package Registry. Add this to the `.npmrc` in any project that consumes it:

```
@kad-products:registry=https://npm.pkg.github.com
```

You'll also need a GitHub PAT with `read:packages` scope either in that `.npmrc` or as `NODE_AUTH_TOKEN` in your environment:

```
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

### Install

```sh
pnpm add @kad-products/shed
```

### Importing

Imports are scoped by project type and by server/client boundary. There is no top-level `@kad-products/shed` export.

#### rwsdk

```ts
// Server-side: utilities, classes, anything that touches Cloudflare Workers APIs
import { KADAccessError } from '@kad-products/shed/rwsdk/server'

// Client-side: React components and browser-safe utilities
import { SomeComponent } from '@kad-products/shed/rwsdk/client'
```

The split is intentional — `rwsdk/server` can safely import `cloudflare:workers` and other server-only APIs. `rwsdk/client` must not. Keeping them separate means client bundlers never see server imports, even transitively.

### Gotchas

- **ESM only.** This package ships ESM and sets `"type": "module"`. Consuming projects need to support ESM imports. CommonJS `require()` is not supported.
- **TypeScript path resolution.** If your tsconfig uses `moduleResolution: "node"` (older setting), subpath exports may not resolve. Use `"bundler"`, `"node16"`, or `"nodenext"`.
- **React is a peer dependency.** It's optional at the package level, but components in `rwsdk/client` expect React to be present in the consuming project. You won't get an install-time error if it's missing — it'll fail at runtime.
- **`cloudflare:workers` is external.** It's a virtual module injected by the Workers runtime, not a real npm package. It's marked external in the build, so consuming projects must be running in a Workers environment (or a wrangler dev context) for server imports to work.
