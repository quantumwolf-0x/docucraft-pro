# Graph Report - docucraft-pro  (2026-07-25)

## Corpus Check
- 111 files · ~124,719 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 798 nodes · 1320 edges · 54 communities (51 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7ecb4927`
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
- Mermaid.tsx
- sheet.tsx
- cn
- command.tsx
- menubar.tsx
- AskAiPanel.tsx
- workspace-artifacts.ts
- Sidebar.tsx
- persistence.ts
- document-utils.ts
- markdown-utils.ts
- InteractiveBlock.tsx
- context.ts
- context-menu.tsx
- alert-dialog.tsx
- table.tsx
- breadcrumb.tsx
- drawer.tsx
- navigation-menu.tsx
- select.tsx
- card.tsx
- toggle-group.tsx
- input-otp.tsx
- HomePage.tsx
- WorkspaceMenu.tsx
- accordion.tsx
- avatar.tsx
- chart.tsx
- tabs.tsx
- react
- Routes
- babel-standalone.d.ts
- mammoth.browser.d.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 69 edges
2. `DocsApp()` - 21 edges
3. `DocuCraft Pro — One-Shot Build Prompt` - 18 edges
4. `MdFile` - 17 edges
5. `compilerOptions` - 17 edges
6. `MarkdownViewer()` - 16 edges
7. `getDocumentKind()` - 16 edges
8. `runAgent()` - 14 edges
9. `splitIntoSubtopics()` - 12 edges
10. `Highlight` - 11 edges

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

## Communities (54 total, 3 thin omitted)

### Community 0 - "dependencies"
Cohesion: 0.03
Nodes (66): dependencies, @babel/standalone, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, @fontsource/atkinson-hyperlegible (+58 more)

### Community 1 - "routeTree.gen.ts"
Cohesion: 0.07
Nodes (32): sonner, Toaster(), ToasterProps, consumeLastCapturedError(), renderErrorPage(), getRouter(), Route, Route (+24 more)

### Community 2 - "carousel.tsx"
Cohesion: 0.15
Nodes (11): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+3 more)

### Community 3 - "devDependencies"
Cohesion: 0.07
Nodes (28): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+20 more)

### Community 4 - "MarkdownViewer.tsx"
Cohesion: 0.12
Nodes (29): EmbeddedMarkdown(), Lightbox(), Callout(), CALLOUT_MAP, CodeBlock(), extractText(), HeadingLink(), MarkdownViewer() (+21 more)

### Community 5 - "sidebar.tsx"
Cohesion: 0.07
Nodes (29): Input, Separator, Sidebar, SidebarContent, SidebarContext, SidebarContextProps, SidebarFooter, SidebarGroup (+21 more)

### Community 6 - "DocumentViewer.tsx"
Cohesion: 0.11
Nodes (18): jszip, xlsx, decodeXml(), DocxViewer(), extractLegacyPptSlides(), GoogleProps, GoogleViewer(), MammothBrowser (+10 more)

### Community 7 - "types.ts"
Cohesion: 0.13
Nodes (15): DefaultModel(), geminiProvider, openaiProvider, allModels(), PROVIDER_LIST, providerForModel(), PROVIDERS, readSSE() (+7 more)

### Community 8 - "utils.ts"
Cohesion: 0.08
Nodes (15): Alert, AlertDescription, AlertTitle, alertVariants, Checkbox, HoverCardContent, PopoverContent, Progress (+7 more)

### Community 9 - "keys.ts"
Cohesion: 0.18
Nodes (21): ProviderKeyRow(), decryptSecret(), deleteSecret(), EncryptedRecord, encryptedStorageAvailable(), encryptSecret(), getMasterKey(), hasWebCrypto() (+13 more)

### Community 10 - "agent.ts"
Cohesion: 0.20
Nodes (21): AiSettings(), AskArgs, useAI(), AgentInput, AgentResult, asAIError(), defaultPreference(), exhaustionError() (+13 more)

### Community 11 - "DocsApp.tsx"
Cohesion: 0.14
Nodes (19): clampWidth(), DocsApp(), loadSidebarWidth(), Theme, WorkspaceLite, HighlightsOnlyModal(), loadPrefs(), parseWorkspaceImport() (+11 more)

### Community 12 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 13 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 14 - "SettingsPage.tsx"
Cohesion: 0.14
Nodes (18): DEFAULT_VIEW, Props, Sidebar(), SidebarView, dataUrl(), fileExtension(), fileLabel(), importDocumentFile() (+10 more)

### Community 15 - "Mermaid.tsx"
Cohesion: 0.16
Nodes (10): mermaid, configure(), Mermaid(), quoteErEntities(), renderMermaid(), evaluateComponent(), InteractiveRuntime(), RunMessage (+2 more)

### Community 16 - "sheet.tsx"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 17 - "cn"
Cohesion: 0.22
Nodes (8): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle

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

### Community 22 - "Sidebar.tsx"
Cohesion: 0.09
Nodes (24): Props, READER_THEME_META, READING_FONT_META, READING_MODE_META, SettingsPage(), SettingsPageProps, Highlight, DARK_THEMES (+16 more)

### Community 23 - "persistence.ts"
Cohesion: 0.16
Nodes (18): Badge(), BadgeProps, badgeVariants, Button, ButtonProps, buttonVariants, Calendar(), CalendarDayButton() (+10 more)

### Community 24 - "document-utils.ts"
Cohesion: 0.40
Nodes (3): Props, WorkspaceLite, WorkspaceMenu()

### Community 25 - "markdown-utils.ts"
Cohesion: 0.18
Nodes (17): CommandPalette(), Hit, Props, DocumentViewer(), InlineArtifact(), Props, renderArtifact(), useObjectUrl() (+9 more)

### Community 26 - "InteractiveBlock.tsx"
Cohesion: 0.23
Nodes (9): htmlDocument(), InteractiveBlock(), InteractiveBlockProps, InteractiveKind, interactiveMode, RuntimeError, toRuntimeError(), ResizableHandle() (+1 more)

### Community 27 - "context.ts"
Cohesion: 0.33
Nodes (9): AIAction, cap(), dedupeDocuments(), estimateTokens(), resolveContext(), ResolvedContext, stripNoise(), tidy() (+1 more)

### Community 28 - "context-menu.tsx"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 29 - "alert-dialog.tsx"
Cohesion: 0.40
Nodes (5): HomePage(), Props, stripExt(), WorkspaceFileItem, WorkspaceItem

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

### Community 34 - "select.tsx"
Cohesion: 0.25
Nodes (7): SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger

### Community 35 - "card.tsx"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 36 - "toggle-group.tsx"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 37 - "input-otp.tsx"
Cohesion: 0.33
Nodes (5): input-otp, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 38 - "HomePage.tsx"
Cohesion: 0.19
Nodes (11): Props, WorkspaceLite, WorkspaceSheet(), SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader() (+3 more)

### Community 40 - "WorkspaceMenu.tsx"
Cohesion: 0.15
Nodes (12): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+4 more)

### Community 41 - "accordion.tsx"
Cohesion: 0.50
Nodes (3): AccordionContent, AccordionItem, AccordionTrigger

### Community 42 - "avatar.tsx"
Cohesion: 0.50
Nodes (3): Avatar, AvatarFallback, AvatarImage

### Community 43 - "chart.tsx"
Cohesion: 0.20
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 44 - "tabs.tsx"
Cohesion: 0.50
Nodes (3): TabsContent, TabsList, TabsTrigger

### Community 45 - "react"
Cohesion: 0.29
Nodes (6): react, useCarousel(), useChart(), useFormField(), useSidebar(), useIsMobile()

## Knowledge Gaps
- **378 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `css` (+373 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `persistence.ts` to `carousel.tsx`, `sidebar.tsx`, `utils.ts`, `sheet.tsx`, `cn`, `command.tsx`, `menubar.tsx`, `InteractiveBlock.tsx`, `context-menu.tsx`, `table.tsx`, `breadcrumb.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `select.tsx`, `card.tsx`, `toggle-group.tsx`, `input-otp.tsx`, `HomePage.tsx`, `WorkspaceMenu.tsx`, `accordion.tsx`, `avatar.tsx`, `chart.tsx`, `tabs.tsx`?**
  _High betweenness centrality (0.276) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `routeTree.gen.ts`, `devDependencies`, `input-otp.tsx`, `DocumentViewer.tsx`, `react`, `Mermaid.tsx`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `SheetHeader()` connect `HomePage.tsx` to `sidebar.tsx`, `persistence.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _378 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.030303030303030304 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._