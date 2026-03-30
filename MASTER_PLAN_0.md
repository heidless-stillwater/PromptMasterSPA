# MASTER_PLAN_0: PromptMaster SPA

## Goal
Create a high-fidelity, themeable Single Page Application (SPA) for customizing Nanobanana prompts, generating images via the PromptTool API, and managing the prompt/image lifecycle within the Stillwater Studio ecosystem.

## Workspace & Integration Points
- **Core Platform**: `~/projects/PromptMasterSPA` (this SPA)
- **Video Engine**: `~/projects/ag-video-system`
- **Generation API**: `~/projects/PromptTool`
- **Resource Data**: `~/projects/PromptResources`
- **Firebase Project**: `heidless-apps-0`
- **Firestore DB**: `promptmaster-spa-db-0`

## Tasks

### Phase 1: Foundation & Infrastructure
- [x] **Task 1: Initialize Project** → Run `npx create-vite-app@latest ./ --template react-ts`, install Tailwind CSS, and configure the base directory.
- [x] **Task 2: Firebase Integration** → Initialize Firebase Auth and Firestore for `heidless-apps-0` / `promptmaster-spa-db-0`.
- [x] **Task 3: Cross-App Auth Alignment** → Implement `AuthContext` with UID/Role synchronization logic consistent with `PromptTool` and `ag-video-system`.

### Phase 2: Core Prompt Experience
- [x] **Task 4: Prompt Discovery Hub** → Build a grid view fetching available prompts from `prompttool-db-0` (referencing `~/projects/PromptResources` schema) with example thumbnails.
- [x] **Task 5: Variable Substitution Engine** → Implement a regex-based parser for `{{variable}}` syntax that dynamically generates input fields for selected prompts.
- [x] **Task 6: Live Preview & Substitution** → Create a real-time "Resultant View" that updates as the user fills in variable fields.

### Phase 3: Generation & Lifecycle
- [x] **Task 7: PromptTool API Bridge** → Integrate with the `~/projects/PromptTool/src/app/api/generate/route.ts` API. Re-routed via Vite Proxy to fix CORS.
- [x] **Task 8: Persistence Layer** → Enabled "Save", storing outputs in `promptmaster-spa-db-0` under `generations`.

### Phase 4: Advanced Features & UX
- [x] **Task 9: Theme Engine Architecture** → Implemented tailwind-based `midnight`, `cyberpunk`, and `neon` modes.
- [x] **Task 10: Deep Linking & URL Invocation** → React Router handles `/p/:promptId?style=:theme` URL logic.
- [x] **Task 11: Settings & Engine Selection** → The UI drop-down dictates generation logic (`nanobanana-2.0` vs `nanobanana-pro`).

### Phase X: Optimization & Deployment
- [x] **Task 12: Premium UI Refinement** → Apply Stillwater Studio's premium aesthetic (polished).
- [x] **Task 13: Deployment** → Deploy to Firebase Hosting and verify cross-app navigation.

## Done When
- [ ] User can sign in via Firebase and see their unified profile.
- [ ] User can select a prompt, fill in variables, and see a live substitution.
- [ ] "Submit" triggers an image generation that appears in the SPA.
- [ ] Direct URLs successfully load specific prompts with custom styling.

## Proposed Settings Options
| Setting | Description | Default / Available |
|---------|-------------|---------------------|
| Nanobanana Engine | Choice of generation model | `nanobanana-2`, `nanobanana-pro` |
| Veo Engine | Video generation model | `veo-1`, `veo-turbo` |
| Default Aspect Ratio | Global default for new prompts | `16:9`, `9:16`, `1:1` |
| Auto-Save | Save prompt configurations automatically | `on`, `off` |

## Notes
- **API Integration**: Requires proper CORS handling or a proxy to interact with `PromptTool`'s Next.js API.
- **Variable Highlighting**: Use a specialized text area or `contenteditable` for the highlighted variable view in Task 5.
