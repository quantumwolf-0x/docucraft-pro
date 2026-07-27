# Graph Report - docucraft-pro  (2026-07-27)

## Corpus Check
- 119 files · ~120,769 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 879 nodes · 1536 edges · 61 communities (57 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0c28721f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dependencies
- routeTree.gen.ts
- carousel.tsx
- devDependencies
- MarkdownViewer.tsx
- sidebar.tsx
- DocumentViewer.tsx
- types.ts
- utils.ts
- keys.ts
- agent.ts
- DocsApp.tsx
- compilerOptions
- components.json
- SettingsPage.tsx
- Sidebar.tsx
- sheet.tsx
- persistence.ts
- command.tsx
- menubar.tsx
- AskAiPanel.tsx
- workspace-artifacts.ts
- InteractiveBlock.tsx
- persistence.ts
- workspace-artifacts.ts
- markdown-utils.ts
- sheet.tsx
- context.ts
- context-menu.tsx
- alert-dialog.tsx
- table.tsx
- breadcrumb.tsx
- drawer.tsx
- navigation-menu.tsx
- workspace-artifacts.ts
- card.tsx
- toggle-group.tsx
- input-otp.tsx
- document-utils.ts
- Sidebar.tsx
- persistence.ts
- avatar.tsx
- carousel.tsx
- MdFile
- package.json
- Routes
- babel-standalone.d.ts
- alert-dialog.tsx
- WorkspaceSheet.tsx
- MarkdownViewer
- source-locate.ts
- mammoth.browser.d.ts
- media-embeds.tsx
- alert.tsx
- CommandPalette.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 74 edges
2. `DocsApp()` - 29 edges
3. `MarkdownViewer()` - 26 edges
4. `MdFile` - 18 edges
5. `DocuCraft Pro — One-Shot Build Prompt` - 18 edges
6. `compilerOptions` - 17 edges
7. `getDocumentKind()` - 15 edges
8. `runAgent()` - 14 edges
9. `splitIntoSubtopics()` - 13 edges
10. `SavedItem` - 12 edges

## Surprising Connections (you probably didn't know these)
- `MarkdownViewer()` --references--> `css`  [EXTRACTED]
  src/components/docs/MarkdownViewer.tsx → components.json
- `PresentationViewer()` --references--> `jszip`  [EXTRACTED]
  src/components/docs/DocumentViewer.tsx → package.json
- `CalendarDayButton()` --references--> `react`  [EXTRACTED]
  src/components/ui/calendar.tsx → package.json
- `useCarousel()` --references--> `react`  [EXTRACTED]
  src/components/ui/carousel.tsx → package.json
- `useChart()` --references--> `react`  [EXTRACTED]
  src/components/ui/chart.tsx → package.json

## Import Cycles
- None detected.

## Communities (61 total, 4 thin omitted)

### Community 0 - "dependencies"
Cohesion: 0.03
Nodes (66): dependencies, @babel/standalone, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, @fontsource/atkinson-hyperlegible (+58 more)

### Community 1 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (37): sonner, Toaster(), ToasterProps, consumeLastCapturedError(), renderErrorPage(), getRouter(), Route, evaluateComponent() (+29 more)

### Community 2 - "carousel.tsx"
Cohesion: 0.05
Nodes (35): react, Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext (+27 more)

### Community 3 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+9 more)

### Community 4 - "MarkdownViewer.tsx"
Cohesion: 0.12
Nodes (18): Lightbox(), Callout(), CALLOUT_MAP, CodeBlock(), extractText(), HeadingLink(), SavedContext, Props (+10 more)

### Community 5 - "sidebar.tsx"
Cohesion: 0.05
Nodes (39): Input, Separator, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay (+31 more)

### Community 6 - "DocumentViewer.tsx"
Cohesion: 0.14
Nodes (22): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+14 more)

### Community 7 - "types.ts"
Cohesion: 0.13
Nodes (15): DefaultModel(), geminiProvider, openaiProvider, allModels(), PROVIDER_LIST, providerForModel(), PROVIDERS, readSSE() (+7 more)

### Community 8 - "utils.ts"
Cohesion: 0.08
Nodes (14): AccordionContent, AccordionItem, AccordionTrigger, Checkbox, HoverCardContent, PopoverContent, Progress, RadioGroup (+6 more)

### Community 9 - "keys.ts"
Cohesion: 0.18
Nodes (21): ProviderKeyRow(), decryptSecret(), deleteSecret(), EncryptedRecord, encryptedStorageAvailable(), encryptSecret(), getMasterKey(), hasWebCrypto() (+13 more)

### Community 10 - "agent.ts"
Cohesion: 0.20
Nodes (21): AiSettings(), AskArgs, useAI(), AgentInput, AgentResult, asAIError(), defaultPreference(), exhaustionError() (+13 more)

### Community 11 - "DocsApp.tsx"
Cohesion: 0.17
Nodes (15): clampWidth(), DocsApp(), loadSidebarWidth(), Theme, WorkspaceLite, DEFAULT_VIEW, SidebarView, useHistory() (+7 more)

### Community 12 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 13 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 15 - "Sidebar.tsx"
Cohesion: 0.36
Nodes (5): mermaid, configure(), Mermaid(), quoteErEntities(), renderMermaid()

### Community 16 - "sheet.tsx"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 17 - "persistence.ts"
Cohesion: 0.20
Nodes (20): SavableBlock(), build(), buildRange(), collapse(), compactOf(), contextAround(), findAnchor(), firstTextRange() (+12 more)

### Community 18 - "command.tsx"
Cohesion: 0.12
Nodes (14): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut() (+6 more)

### Community 19 - "menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 20 - "AskAiPanel.tsx"
Cohesion: 0.20
Nodes (11): AskAiFile, AskAiPanel(), AskAiPrefill, ContextMode, defaultDocName(), Props, stripExt(), ACTION_GROUPS (+3 more)

### Community 21 - "workspace-artifacts.ts"
Cohesion: 0.10
Nodes (20): 10. Bookmarks & library, 11. Workspaces (multi-project organization), 12. Ask AI (bring-your-own-key, private), 13. Settings page (`/settings`, tabbed), 14. Personalization & niceties, 15. Responsive & accessibility, 16. Privacy & guarantees (state these in the UI), 17. Routes (+12 more)

### Community 22 - "InteractiveBlock.tsx"
Cohesion: 0.23
Nodes (9): htmlDocument(), InteractiveBlock(), InteractiveBlockProps, InteractiveKind, interactiveMode, RuntimeError, toRuntimeError(), ResizableHandle() (+1 more)

### Community 23 - "persistence.ts"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 24 - "workspace-artifacts.ts"
Cohesion: 0.50
Nodes (3): TabsContent, TabsList, TabsTrigger

### Community 25 - "markdown-utils.ts"
Cohesion: 0.10
Nodes (20): jszip, xlsx, decodeXml(), DocxViewer(), extractLegacyPptSlides(), GoogleProps, MammothBrowser, PdfViewer() (+12 more)

### Community 26 - "sheet.tsx"
Cohesion: 0.13
Nodes (12): READER_THEME_META, READING_FONT_META, READING_MODE_META, SavedSettings(), SettingsPage(), StorageSettings(), ReadingFont, ThemePref (+4 more)

### Community 27 - "context.ts"
Cohesion: 0.33
Nodes (9): AIAction, cap(), dedupeDocuments(), estimateTokens(), resolveContext(), ResolvedContext, stripNoise(), tidy() (+1 more)

### Community 28 - "context-menu.tsx"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 29 - "alert-dialog.tsx"
Cohesion: 0.19
Nodes (10): HighlightsOnlyModal(), HomePage(), Props, stripExt(), WorkspaceFileItem, WorkspaceItem, Modal(), ModalProps (+2 more)

### Community 30 - "table.tsx"
Cohesion: 0.22
Nodes (8): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow

### Community 31 - "breadcrumb.tsx"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 32 - "drawer.tsx"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 33 - "navigation-menu.tsx"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 34 - "workspace-artifacts.ts"
Cohesion: 0.33
Nodes (6): Action, apply(), History, HistoryState, reducer(), Updater

### Community 35 - "card.tsx"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 36 - "toggle-group.tsx"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 37 - "input-otp.tsx"
Cohesion: 0.33
Nodes (5): input-otp, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 38 - "document-utils.ts"
Cohesion: 0.22
Nodes (16): DocumentViewer(), EmbeddedMarkdown(), InlineArtifact(), Props, renderArtifact(), useObjectUrl(), getDocumentKind(), artifactReference() (+8 more)

### Community 40 - "Sidebar.tsx"
Cohesion: 0.16
Nodes (12): KIND_ICON, kindIcon(), savedByFile(), savedIcon(), Sidebar(), Props, WorkspaceLite, WorkspaceMenu() (+4 more)

### Community 41 - "persistence.ts"
Cohesion: 0.13
Nodes (16): DARK_THEMES, DEFAULT_PREFS, emptyUI(), isDarkTheme(), newWorkspaceRecord(), openDb(), parseWorkspaceImport(), PersistedFile (+8 more)

### Community 42 - "avatar.tsx"
Cohesion: 0.50
Nodes (3): Avatar, AvatarFallback, AvatarImage

### Community 43 - "carousel.tsx"
Cohesion: 0.21
Nodes (11): GoogleViewer(), dataUrl(), fileExtension(), googleUrl(), importDocumentFile(), isTextKind(), kindByExtension, DocumentKind (+3 more)

### Community 44 - "MdFile"
Cohesion: 0.35
Nodes (11): Props, SavedContextValue, SettingsPageProps, Props, Highlight, MdFile, ReadingMode, WorkspaceRecord (+3 more)

### Community 45 - "package.json"
Cohesion: 0.17
Nodes (11): name, private, scripts, build, build:dev, dev, format, lint (+3 more)

### Community 48 - "alert-dialog.tsx"
Cohesion: 0.26
Nodes (11): splitIntoSubtopics(), stripExt(), collapse(), findSaved(), migrateBookmarks(), newSavedId(), SAVED_KIND_LABEL, SavedBlockType (+3 more)

### Community 49 - "WorkspaceSheet.tsx"
Cohesion: 0.29
Nodes (5): Props, WorkspaceLite, WorkspaceSheet(), BottomSheet(), BottomSheetProps

### Community 50 - "MarkdownViewer"
Cohesion: 0.22
Nodes (9): MarkdownViewer(), remarkInteractiveBlockMeta(), stripExt(), DecorRange, HL_COLORS, hlGroup(), headingChunkMap(), savedExcerpt() (+1 more)

### Community 51 - "source-locate.ts"
Cohesion: 0.39
Nodes (8): compact(), isWordChar(), locateInSource(), matchBracket(), project(), Projection, projectionOf(), SourceSpan

### Community 58 - "media-embeds.tsx"
Cohesion: 0.33
Nodes (6): detectEmbed(), Embed, EmbedFrame(), isVideoUrl(), VideoPlayer(), yt()

### Community 59 - "alert.tsx"
Cohesion: 0.40
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 60 - "CommandPalette.tsx"
Cohesion: 0.50
Nodes (3): CommandPalette(), Hit, Props

## Knowledge Gaps
- **389 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `baseColor` (+384 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `DocumentViewer.tsx` to `carousel.tsx`, `MarkdownViewer.tsx`, `sidebar.tsx`, `utils.ts`, `sheet.tsx`, `command.tsx`, `menubar.tsx`, `InteractiveBlock.tsx`, `persistence.ts`, `workspace-artifacts.ts`, `context-menu.tsx`, `alert-dialog.tsx`, `table.tsx`, `breadcrumb.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `card.tsx`, `toggle-group.tsx`, `input-otp.tsx`, `avatar.tsx`, `WorkspaceSheet.tsx`, `alert.tsx`?**
  _High betweenness centrality (0.260) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `routeTree.gen.ts`, `carousel.tsx`, `input-otp.tsx`, `package.json`, `Sidebar.tsx`, `markdown-utils.ts`?**
  _High betweenness centrality (0.197) - this node is a cross-community bridge._
- **Why does `mermaid` connect `Sidebar.tsx` to `dependencies`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _389 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.030303030303030304 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05520614954577219 - nodes in this community are weakly interconnected._
- **Should `carousel.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._