# Image Generation Integration Guide

This document is a handoff guide for AI agents continuing the image generation integration work. Read it before making code changes.

## Scope

The image generation module is now located at:

```text
ui/src/pages/Chat/ImageGeneration/
```

It is mounted from the Chat page through:

```text
ui/src/pages/Chat/ImageGenerationWorkspace.tsx
ui/src/pages/Chat/index.tsx
```

The goal is to finish integrating this module as a native part of the existing HCAI Chat workspace, not as an imported standalone app.

## Hard Constraints

- Do not start or run the project unless the user explicitly asks.
- Read code before changing it.
- Do not move large directories again without first listing all references.
- Do not format the whole image generation directory in one pass.
- Do not restore the old standalone `main.tsx`.
- Do not put Vitest test files back under `ui/src/pages/Chat/ImageGeneration/`.
- Preserve unrelated user changes.
- Prefer existing project styles and components over inventing new UI styles.

## Current State

The previous standalone path was removed:

```text
ui/src/image-playground/
```

The current image generation module contains:

```text
ui/src/pages/Chat/ImageGeneration/App.tsx
ui/src/pages/Chat/ImageGeneration/store.ts
ui/src/pages/Chat/ImageGeneration/playground.css
ui/src/pages/Chat/ImageGeneration/components/
ui/src/pages/Chat/ImageGeneration/hooks/
ui/src/pages/Chat/ImageGeneration/lib/
ui/src/pages/Chat/ImageGeneration/types.ts
ui/src/pages/Chat/ImageGeneration/vite-env.d.ts
```

`main.tsx` was deleted because it was a standalone Vite entry and should not be part of the CRA Chat page build.

`vite-env.d.ts` currently only declares globals injected by `DefinePlugin`:

```ts
/* eslint-disable no-underscore-dangle */

declare const __APP_VERSION__: string
declare const __DEV_PROXY_CONFIG__: unknown
```

Image generation tests were moved out of `src` to avoid CRA compiling Vitest tests:

```text
ui/tests/pages/Chat/ImageGeneration/
```

## First Checks Before Any Work

Run read-only checks:

```bash
git status --short
rg "@/image-playground|src/image-playground|ui/src/image-playground" ui
rg "vitest|import.meta|vite/client|main.tsx|source-map-loader|ignoreWarnings|darkMode" ui/src ui/tests ui/.eslintrc.js ui/tsconfig.json ui/config-overrides.js ui/tailwind.config.js ui/package.json
```

Expected:

- No old `@/image-playground` imports.
- No `main.tsx` in `ui/src/pages/Chat/ImageGeneration/`.
- No `.test.ts` or `.test.tsx` in `ui/src/pages/Chat/ImageGeneration/`.
- Vitest imports only under `ui/tests/`.

## Important Files

Read these before making integration changes:

```text
ui/src/pages/Chat/index.tsx
ui/src/pages/Chat/index.scss
ui/src/pages/Chat/ImageGenerationWorkspace.tsx
ui/src/pages/Chat/ImageGeneration/App.tsx
ui/src/pages/Chat/ImageGeneration/store.ts
ui/src/pages/Chat/ImageGeneration/playground.css
ui/src/pages/Chat/ImageGeneration/components/SettingsModal.tsx
ui/src/pages/Chat/ImageGeneration/components/PlaygroundTopbar.tsx
ui/src/pages/Chat/ImageGeneration/components/PlaygroundToolbarControls.tsx
ui/src/pages/Chat/ImageGeneration/components/AgentConversationTaskPanel.tsx
ui/src/components/MobileSideNav/index.tsx
ui/src/components/MobileSideNav/index.scss
ui/src/pages/Chat/VideoGenerationWorkspace.tsx
ui/src/pages/Chat/imageGeneration.scss
ui/.eslintrc.js
ui/tsconfig.json
ui/tailwind.config.js
ui/config-overrides.js
ui/package.json
```

## Known Risks

### 1. Tests Are Not Integrated

Files under `ui/tests/pages/Chat/ImageGeneration/` import `vitest`, but `ui/package.json` currently has no Vitest dependency or test script.

Short-term options:

- Delete/archive those migration tests if the user agrees.
- Or formally add Vitest, a config file, and a test script.

Do not move those test files back into `src`.

### 2. ESLint Override Is Too Broad

`.eslintrc.js` currently has a broad override for:

```js
files: ['src/pages/Chat/ImageGeneration/**/*']
```

It disables many rules, including Prettier and import rules. This is a stopgap to prevent the migrated module from producing thousands of style errors.

Long-term goal:

- Gradually narrow this override.
- Do not remove it all at once.
- Do not run a full-directory format pass without user approval.

### 3. Tailwind Dark Mode Is Not Aligned With Project Theme

`ui/tailwind.config.js` currently uses:

```js
darkMode: 'media'
```

The host project uses:

```text
[data-bs-theme='dark']
```

This means Tailwind `dark:` classes may follow system preference instead of the site theme. The existing `playground.css` compensates with many `[data-bs-theme='dark']` selectors.

Possible future paths:

- Change Tailwind dark mode to a selector compatible with `[data-bs-theme='dark']`.
- Or reduce reliance on Tailwind `dark:` classes and use project CSS variables / `[data-bs-theme='dark']` rules.

Do not change this casually; inspect how Tailwind is compiled first.

### 4. Subscription Props Are Not Used

`ImageGenerationWorkspace.tsx` receives:

```ts
subscription: AiSubscriptionOverview | null
onRefreshSubscription: () => void
onOpenSubscription: () => void
```

But it currently renders:

```tsx
<PlaygroundApp embedded />
```

The image generation page is not yet fully integrated with the host subscription flow.

Recommended future direction:

1. Add props to `PlaygroundApp`.
2. Pass the workspace props through.
3. Study `VideoGenerationWorkspace.tsx` for how subscription and model limits are handled.
4. Only then decide whether subscription checks belong in UI submit flow or in the image generation store.

### 5. Task Queues Use DOM Portals And Custom Events

Current image Agent task list logic uses DOM hosts and window events:

```text
#hcai-sidebar-image-tasks
#hcai-mobile-sidenav-image-tasks
hcai-toggle-image-tasks
hcai-image-tasks-open-change
hcai-close-mobile-side-nav
```

This works but is tightly coupled to Chat DOM ids and event names.

Short-term:

- Keep it if it is stable.
- Avoid changing ids without searching all references.

Long-term:

- Move toward props/context/slot-style task panel composition from `Chat/index.tsx`.
- Centralize event names if custom events remain.

### 6. `playground.css` Is Large And Contains Standalone-App Residue

`playground.css` includes:

- CSS variables copied from the standalone image app.
- Host alignment overrides.
- Modal alignment overrides.
- Dark mode overrides.
- Utility/Tailwind class overrides.

Do not delete big blocks blindly. First confirm which component or old feature uses each block.

## Current UI State To Preserve

User-visible changes that should remain:

- Gallery and Agent use a unified topbar.
- On widths below 620px, Gallery/Agent mode switch is placed in the mobile topbar area.
- Gallery should not show the mobile task queue button.
- Agent should show task queue access.
- Large-screen Agent conversation list appears in the left sidebar task queue.
- Small-screen Agent conversation list appears inside the task queue/mobile side panel.
- "操作指南" was removed completely.
- "安装为应用" was removed completely.
- "关于" was removed from settings.
- Settings modal uses React Bootstrap Modal and `hcai-subscription-dialog`.
- Size picker modal is aligned with subscription dialog style.

## Recommended Next Work Order

### Phase 1: Confirm Structure

Only inspect:

```bash
git status --short
rg "@/image-playground|src/image-playground|ui/src/image-playground" ui
find ui/src/pages/Chat/ImageGeneration -name '*.test.ts' -o -name '*.test.tsx' -o -name 'main.tsx'
```

### Phase 2: Decide Test Strategy

Ask the user whether to:

- remove/archive the migrated Vitest tests, or
- formally add Vitest support.

Recommendation for stability: archive/delete tests short-term; add project-level tests later.

### Phase 3: Integrate Subscription Props

Study:

```text
ui/src/pages/Chat/VideoGenerationWorkspace.tsx
ui/src/pages/Chat/ImageGenerationWorkspace.tsx
ui/src/pages/Chat/ImageGeneration/App.tsx
ui/src/pages/Chat/ImageGeneration/store.ts
```

Then pass subscription callbacks into the image module deliberately.

### Phase 4: Theme Integration

Study:

```text
ui/src/utils/common.ts
ui/src/common/liquid-glass.scss
ui/src/pages/Chat/index.scss
ui/src/pages/Chat/ImageGeneration/playground.css
ui/tailwind.config.js
```

Goal:

- Align image generation dark mode with `[data-bs-theme='dark']`.
- Avoid adding more one-off dark overrides unless necessary.

### Phase 5: Reduce Standalone Residue

Candidates:

- `vite-env.d.ts`: consider moving global declarations into a project-level declarations file.
- `.eslintrc.js`: narrow broad override after formatting selected files.
- `playground.css`: split host integration styles from image-page-specific component styles.
- `config-overrides.js`: revisit `rehype-harden` source map workaround after dependency changes.

## Do Not Do

- Do not run the dev server.
- Do not restore `main.tsx`.
- Do not move tests back into `src`.
- Do not perform a full reformat of all migrated files without explicit permission.
- Do not replace project modal styles with custom fixed overlays.
- Do not remove portal hosts without replacing all callers.
- Do not assume Tailwind `dark:` follows the project dark theme.

## Communication Notes

The user is understandably sensitive to build errors after the previous migration. Be explicit before risky changes:

- State which files will change.
- State why the change is necessary.
- Prefer small, reversible steps.
- After edits, use static searches to verify references.
- If tests/build are not run, say that clearly.

