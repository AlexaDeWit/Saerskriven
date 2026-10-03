# Opening, saving and exporting

The studio reaches files through `FileBridge` (`bridge.ts`), a record of
functions the app is handed rather than a platform it calls. A spec is handed a
recording one. Every path answers with an outcome, and nothing throws. What a
person sees, and what an OTM or TM-BOM file becomes, is in
[Using the studio](../../../../docs/studio.md#files).

## Modules

| Module                                                           | What it holds                                                                                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `bridge.ts`, `browser-bridge.ts`                                 | The bridge interface, and the browser's: the File System Access API where it exists, a file input and a download otherwise |
| `session.ts`                                                     | What the studio does with a file, as pure functions: read, write, and `formatFiles`                                        |
| `file-commands.ts`                                               | The one session the app owns: file and export commands, reports, and the questions the menu asks                           |
| `export-commands.ts`, `render-assets.ts`                         | The projections through `@saerskriven/render`, and the loader for the WebAssembly modules and faces                        |
| `share-link.ts`, `share-notice.ts`                               | Share, reading a shared link when it arrives, the question it asks over unsaved work, and the share report                 |
| `menu.tsx`, `menu-items.tsx`, `submenu.tsx`, `radio-choices.tsx` | The burger menu, the items it and the switcher share, the second level, and a one-of-several group                         |
| `settings-menu.tsx`                                              | The appearance and language submenus                                                                                       |
| `diagram-switcher.tsx`                                           | The control joined to the burger that names, switches, adds and renames diagrams                                           |
| `file-reports.tsx`                                               | The failure notice, the crossing report, the export report and the share report, hung under the chrome card                |
| `../system-clipboard.ts`                                         | The one write to the system clipboard, which Copy, Cut and Share go through                                                |

## The bridge

`NoPicker` is the browser's arm of the open outcome and nobody else's: only a
component can hold a file input, so a bridge without a picker says "not me"
and the view opens one. `asksWhere` is the same fact on the save side, and a
question rather than an answer: a save-as puts every registered format in the
platform's picker, so a platform with none is asked in advance and the studio
puts the question in its own menu, handing the save-as the one format it
settled on.

`writesBack` says whether the bridge holds a file for Save to write to. A Save
with none takes the no-handle path: where the platform can ask where, the
session runs the save-as route, so the picker proposes the same name and
formats, the file chosen there becomes the one later Saves write to, and a
dismissed picker dispatches nothing. Where it cannot ask, the bridge's `save`
downloads and answers `Written`, since the page cannot see the browser's own
dialog ([Using the studio](../../../../docs/studio.md#files)).

Each bridge open, fallback read, save, or save-as starts one operation. The
latest request owns settlement, regardless of completion order. The bridge
returns an outcome and a settlement function without changing its held handle,
and the session validates the read and settles the handle before dispatching
the matching store action, with no asynchronous step between them. A stale
settlement returns false and changes neither association. Close releases the
handle and invalidates pending operations. Exports own no file association and
do not interrupt these operations. A save already in progress can still write
its target, but once another file operation starts it cannot rename or mark the
current model saved.

A failed open, whether the read failed or a codec refused the text, keeps the
model, history, saved checkpoint and loss report, but drops the file
association and releases the handle, so the next Save leaves both files
untouched. A refused save keeps the file and handle for retry. Dismissing a
picker keeps the last settled association and does not revive an older pending
operation. An empty fallback selection starts no operation, and a successful
one settles with no handle, so its next Save takes the no-handle path under
the chosen name. An open of OTM or TM-BOM, which Saerskriven reads and does
not write, releases the handle on success as well, so no Save writes to that
file, and names the model as YAML under the file's stem.

## Reading and writing

A read is the size against `readLimits.maxTextBytes` first, since that bound
keeps the parse finite, then `readOrImport`, then one action: the model, or
the codec's or the import's own failure, which the notice renders with the
paths it carries. A model converted from OTM or TM-BOM is `Imported`: new,
unsaved, and with no document retained for a save to merge onto. A shared
link is `LinkOpened`, which the reducer settles as it settles `Imported`.
A write is the codec's own write for the file's format, then the bridge, then
one action.

`formatFiles` is the one table saying how a format appears as a file: its
name from [`../format-names.ts`](../format-names.ts), the media type a picker
files it under, and the extensions it is written with. `saveTypes` is that table as a picker takes it,
the file's own format first, and `formatOfName` is the way back: the extension
of the name a picker answers with says which codec writes the text. Nothing
else reads an extension as a format. The text of a save-as is written once the
picker has answered, because until then which codec writes it is the person's
to decide.

Which document a write merges onto decides whether what Saerskriven does not
model survives, so the document a read retained rides in the store beside the
file's name ([the store](../store/README.md)). Saving in the format a model was
read from merges onto it. Saving in any other format has nothing to merge onto,
so the codec projects, which is where a loss report comes from. A read reports
too: a wire schema drops every key it does not declare, and the retained
document has lost them as well, so no later save can say what became of them.
An open marks each loss `keptByWriteBack` says a save to the same file keeps,
and each report names its subjects from the model it opened or saved. An open
of OTM or TM-BOM always reports, losses or none, because its report carries
the notice that the model is new and that Save makes a Saerskriven file.
Both reports describe one crossing of the file boundary rather than the model,
and each stands until a save starts, an open lands, or the file is closed. A
refused open leaves the report alone, nothing having crossed.

Recovery stores the file's name, format and retained document with the model,
and no native handle, so after a reload Save takes the no-handle path and
still merges through the retained document. The session watches the tab sync,
and every result it follows releases the handle, one naming the same file
included, since a name cannot say whether it is the same file. It also puts
away the crossing report and every open question
([the store](../store/README.md#other-tabs)).

## The session and the menu

The file and export actions are registered commands
([the commands](../commands/README.md)), so a chord and a menu item run the
same dispatch. Each reads the store as it runs rather than closing over a
render, which is what lets the commands be built once. The reducer is total
and cannot refuse an open or a close over unsaved work, so the session asks
first: it holds the question as `opening` or `closing`, the menu item becomes
the confirmation, and answering, dismissing the menu or the model becoming
clean clears it. The session owns the question so that a keyboard shortcut can
open the menu on it. New model releases the native handle only after the
recovery snapshot clears.

`choosing` is that shape a second time, for the format a save-as writes, asked
only where the platform has no picker. Firefox and Safari are that browser, so
the question is a path in its own right, not a fallback. It is a second press
on the item rather than a submenu because that is one press deep, keeps the
keyboard where it was, and adds no second overlay. Whether the platform asks is
read as the item is drawn, so nothing has to close the menu and open it again
around an answer.

The burger starts row one of the shell's chrome card
([`../app/chrome.tsx`](../app/chrome.tsx)). `submenu.tsx` opens the second
level at the start edge of that card rather than beside the menu, so every
item in it is on screen at every width down to a phone. It never covers its
own row: it opens under the row where its whole height fits, over the row
where it fits there, and otherwise scrolls on the side with more room. The menu
also holds the fallback picker's input and the guard on closing the tab, which
stands only while the model is dirty and the latest recovery write is
unconfirmed. A notice or report cannot go inside the menu, which owns items and
groups only, so `file-reports.tsx` hangs them under the card. The crossing
report, the export report and the share report share one named live region
there, and the failure notice holds its own.

## Exports

`export-commands.ts` writes a diagram as SVG, the register as Markdown, and
the whole model as Typst. The PDF path compiles that Typst source through the
render package's `pdf` subpath, and the PNG path draws the diagram on screen
through its `png` subpath. Both read bytes rather than files, so both go
through `render-assets.ts` first, and a refusal from either reports as a notice
and writes nothing. An export uses the bridge's picker or download path but
never replaces the handle Save writes back to.

`render-assets.ts` fetches the three WebAssembly modules and the five
Liberation faces the Vite build emits, the faces once for both readers, and
caches the bytes after the first successful read. Vite's `?url` import owns
each module. The face list and the compiler's order come from the
render-owned build module the CLI uses too, and the PNG loader leads that list
with `drawingFace`, because the rasterizer letters a family no loaded face
carries in the first face it was offered, and the drawings name Helvetica and
Arial. A build carrying no such face is refused. The compiler, the rasterizer
and the faces load only when a PDF or PNG export runs, and Vite keeps the
compiler's JavaScript in a separate hashed chunk. The brotli module a share
link is written and read with loads only when Share runs or the address holds
a link ([Share links](#share-links)).

An export report carries a Dismiss button, and `refusal` on the report decides
what else ends it. A written export reports informationally, so it goes at the
next action that moves canvas or panel state, the transient lifetime the store
defines ([the store](../store/README.md#the-shape)). An export the browser, the
asset loader or the compiler refused stands until Dismiss or a later export.
No notice here is taken away by a timer: an error a clock removes is one a
person reading slowly never reads.

## Share links

Share writes the model as a link through `@saerskriven/formats/share-link`,
on the page's own address (`location.origin` and `location.pathname`, so a
Pages base path stays and a query does not), and puts it on the clipboard.
The encoding runs on the main thread, as the PDF and PNG exports do. The
clipboard write is asked for as Share runs, before the link is written, as a
`ClipboardItem` holding the link to come, so the press that ran Share still
holds when the link is ready: Firefox refuses a `writeText` that follows
seconds of work, which a model near the ceiling takes. The share
report gives the link's length and says that anyone holding the link can read
the whole model. A link past `shareLinkLimit`, or a model whose text is past
the read bound, is refused with a report pointing to Save, and nothing reaches
the clipboard. The share report stands until Dismiss or the next Share, since
it carries the disclosure.

`useShareLink` reads `location.hash` when the studio mounts and at each
`hashchange`, so a link pasted into an open tab loads without a reload. The
module loads only once `isShareLinkFragment` says the fragment is a link. The
store boots from recovery synchronously and the decoding is asynchronous, so a
link is always read after boot. A link that reads lands as `LinkOpened`, named
after the model's title with the native extension, after the session releases
the native handle, so the model arrives unsaved and the close guard and
recovery hold it. What the read could not carry goes to the crossing report,
and a refused link to the failure notice, worded from the failure's tag.

The landing is published to every other tab, so the question comes first.
While the session holds unsaved work (`holdsUnsavedWork`: unsaved changes, or
a recovery snapshot that could not be read at startup and that nothing has
replaced since), the Share item turns into Discard changes and open the link,
with Cancel under it, as Open and Import ask. Answering, Cancel, a dismissed
menu, the model becoming clean, and following another tab each settle it.
The fragment is removed with `history.replaceState` once the link lands, is
refused, or the question is settled, keeping the path and the query, so a
reload neither asks again nor loads the link over later edits. One fragment
is read once, however often the effect runs, which is what keeps the
development server's double effects from asking twice.
