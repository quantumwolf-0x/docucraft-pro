# Graph Report - docucraft-pro  (2026-07-27)

## Corpus Check
- 118 files · ~115,403 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 848 nodes · 1422 edges · 54 communities (50 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6fa744e9`
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
- Routes
- babel-standalone.d.ts
- WorkspaceSheet.tsx
- alert.tsx
- mammoth.browser.d.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 74 edges
2. `DocsApp()` - 24 edges
3. `MarkdownViewer()` - 19 edges
4. `DocuCraft Pro — One-Shot Build Prompt` - 18 edges
5. `MdFile` - 17 edges
6. `compilerOptions` - 17 edges
7. `getDocumentKind()` - 15 edges
8. `runAgent()` - 14 edges
9. `Highlight` - 11 edges
10. `splitIntoSubtopics()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `PresentationViewer()` --references--> `jszip`  [EXTRACTED]
  src/components/docs/DocumentViewer.tsx → package.json
- `CalendarDayButton()` --references--> `react`  [EXTRACTED]
  src/components/ui/calendar.tsx → package.json
- `useCarousel()` --references--> `react`  [EXTRACTED]
  src/components/ui/carousel.tsx → package.json
- `useChart()` --references--> `react`  [EXTRACTED]
  src/components/ui/chart.tsx → package.json
- `useFormField()` --references--> `react`  [EXTRACTED]
  src/components/ui/form.tsx → package.json

## Import Cycles
- None detected.

## Communities (54 total, 4 thin omitted)

### Community 0 - "dependencies"
Cohesion: 0.03
Nodes (67): dependencies, @babel/standalone, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, @fontsource/atkinson-hyperlegible (+59 more)

### Community 1 - "routeTree.gen.ts"
Cohesion: 0.07
Nodes (32): sonner, Toaster(), ToasterProps, consumeLastCapturedError(), renderErrorPage(), getRouter(), Route, Route (+24 more)

### Community 2 - "carousel.tsx"
Cohesion: 0.05
Nodes (35): react, Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext (+27 more)

### Community 3 - "devDependencies"
Cohesion: 0.07
Nodes (28): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+20 more)

### Community 4 - "MarkdownViewer.tsx"
Cohesion: 0.07
Nodes (48): Lightbox(), Callout(), CALLOUT_MAP, CodeBlock(), extractText(), HeadingLink(), MarkdownViewer(), remarkInteractiveBlockMeta() (+40 more)

### Community 5 - "sidebar.tsx"
Cohesion: 0.05
Nodes (38): Input, Separator, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay (+30 more)

### Community 6 - "DocumentViewer.tsx"
Cohesion: 0.13
Nodes (23): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+15 more)

### Community 7 - "types.ts"
Cohesion: 0.13
Nodes (15): DefaultModel(), geminiProvider, openaiProvider, allModels(), PROVIDER_LIST, providerForModel(), PROVIDERS, readSSE() (+7 more)

### Community 8 - "utils.ts"
Cohesion: 0.10
Nodes (11): Checkbox, HoverCardContent, PopoverContent, Progress, RadioGroup, RadioGroupItem, ScrollArea, ScrollBar (+3 more)

### Community 9 - "keys.ts"
Cohesion: 0.18
Nodes (21): ProviderKeyRow(), decryptSecret(), deleteSecret(), EncryptedRecord, encryptedStorageAvailable(), encryptSecret(), getMasterKey(), hasWebCrypto() (+13 more)

### Community 10 - "agent.ts"
Cohesion: 0.20
Nodes (21): AiSettings(), AskArgs, useAI(), AgentInput, AgentResult, asAIError(), defaultPreference(), exhaustionError() (+13 more)

### Community 11 - "DocsApp.tsx"
Cohesion: 0.21
Nodes (12): clampWidth(), DocsApp(), loadSidebarWidth(), Theme, WorkspaceLite, useHistory(), readingMinutes(), loadPrefs() (+4 more)

### Community 12 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 13 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 15 - "Sidebar.tsx"
Cohesion: 0.16
Nodes (10): mermaid, configure(), Mermaid(), quoteErEntities(), renderMermaid(), evaluateComponent(), InteractiveRuntime(), RunMessage (+2 more)

### Community 16 - "sheet.tsx"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 17 - "persistence.ts"
Cohesion: 0.50
Nodes (3): AccordionContent, AccordionItem, AccordionTrigger

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
Cohesion: 0.06
Nodes (52): jszip, CommandPalette(), Hit, Props, decodeXml(), DocumentViewer(), DocxViewer(), extractLegacyPptSlides() (+44 more)

### Community 26 - "sheet.tsx"
Cohesion: 0.13
Nodes (12): Props, READER_THEME_META, READING_FONT_META, READING_MODE_META, SettingsPage(), SettingsPageProps, Props, Highlight (+4 more)

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
Cohesion: 0.50
Nodes (4): StorageSettings(), formatBytes(), getMaxStorageBytes(), getStorageQuota()

### Community 40 - "Sidebar.tsx"
Cohesion: 0.16
Nodes (11): DEFAULT_VIEW, KIND_ICON, kindIcon(), Sidebar(), SidebarView, Props, WorkspaceLite, WorkspaceMenu() (+3 more)

### Community 41 - "persistence.ts"
Cohesion: 0.15
Nodes (14): DARK_THEMES, DEFAULT_PREFS, emptyUI(), isDarkTheme(), newWorkspaceRecord(), openDb(), PersistedFile, PersistedUI (+6 more)

### Community 42 - "avatar.tsx"
Cohesion: 0.50
Nodes (3): Avatar, AvatarFallback, AvatarImage

### Community 43 - "carousel.tsx"
Cohesion: 0.60
Nodes (4): base64UrlDecode(), base64UrlEncode(), compressAndEncode(), decodeAndDecompress()

### Community 49 - "WorkspaceSheet.tsx"
Cohesion: 0.29
Nodes (5): Props, WorkspaceLite, WorkspaceSheet(), BottomSheet(), BottomSheetProps

### Community 51 - "alert.tsx"
Cohesion: 0.40
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

## Knowledge Gaps
- **388 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `css` (+383 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `DocumentViewer.tsx` to `carousel.tsx`, `MarkdownViewer.tsx`, `sidebar.tsx`, `utils.ts`, `sheet.tsx`, `persistence.ts`, `command.tsx`, `menubar.tsx`, `InteractiveBlock.tsx`, `persistence.ts`, `workspace-artifacts.ts`, `context-menu.tsx`, `alert-dialog.tsx`, `table.tsx`, `breadcrumb.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `card.tsx`, `toggle-group.tsx`, `input-otp.tsx`, `avatar.tsx`, `WorkspaceSheet.tsx`, `alert.tsx`?**
  _High betweenness centrality (0.270) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `routeTree.gen.ts`, `carousel.tsx`, `devDependencies`, `input-otp.tsx`, `Sidebar.tsx`, `markdown-utils.ts`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **Why does `react` connect `carousel.tsx` to `dependencies`, `sidebar.tsx`, `DocumentViewer.tsx`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _388 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.029850746268656716 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `carousel.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._