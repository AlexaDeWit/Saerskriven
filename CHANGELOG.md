## 0.6.0 (2026-09-20)

### 🚀 Features

- **cli:** add --lang to render, default en-CA ([#511](https://github.com/AlexaDeWit/Saerskriven/pull/511))
- **cli:** convert a threat model between wire formats ([#531](https://github.com/AlexaDeWit/Saerskriven/pull/531))
- **formats:** record divergences as codes with parameters ([#492](https://github.com/AlexaDeWit/Saerskriven/pull/492))
- **i18n:** typed message system and locale negotiation ([#490](https://github.com/AlexaDeWit/Saerskriven/pull/490))
- **model:** remove a threat when an edit detaches its last element ([#548](https://github.com/AlexaDeWit/Saerskriven/pull/548))
- **render:** export catalogues and a locale for every rendered document ([#505](https://github.com/AlexaDeWit/Saerskriven/pull/505))
- **studio:** language selection with a persisted locale ([#491](https://github.com/AlexaDeWit/Saerskriven/pull/491))
- **studio:** move the shell, menus and editor controls into the catalogues ([#493](https://github.com/AlexaDeWit/Saerskriven/pull/493))
- **studio:** treat the browser language as a prefill, not a mode ([#495](https://github.com/AlexaDeWit/Saerskriven/pull/495))
- **studio:** localize canvas accessibility and application diagnostics ([#496](https://github.com/AlexaDeWit/Saerskriven/pull/496))
- **studio:** word the untitled save stem in the active language ([#504](https://github.com/AlexaDeWit/Saerskriven/pull/504))
- **studio:** export in the active language and letter badges to match ([#509](https://github.com/AlexaDeWit/Saerskriven/pull/509))
- **studio:** spell shortcut key names in the reader's language ([#520](https://github.com/AlexaDeWit/Saerskriven/pull/520))
- **studio:** localize the canvas role descriptions ([#519](https://github.com/AlexaDeWit/Saerskriven/pull/519))

### 🩹 Fixes

- **canvas:** widen a threat badge's count-to-mark gap so an accent clears ([#515](https://github.com/AlexaDeWit/Saerskriven/pull/515))
- **canvas:** settle flow label ties by the documented order, not by rounding ([#535](https://github.com/AlexaDeWit/Saerskriven/pull/535), [#485](https://github.com/AlexaDeWit/Saerskriven/issues/485))
- **formats:** leave null source fields out of the import report ([#527](https://github.com/AlexaDeWit/Saerskriven/pull/527), [#483](https://github.com/AlexaDeWit/Saerskriven/issues/483))
- **formats:** drop the trailing separator on an unlinked TM-BOM control with no description ([#525](https://github.com/AlexaDeWit/Saerskriven/pull/525))
- **formats:** TM-BOM and OTM import lines keep a separator beside an empty wire string ([#538](https://github.com/AlexaDeWit/Saerskriven/pull/538))
- **formats:** refuse a wire document whose issues overflow zod ([#529](https://github.com/AlexaDeWit/Saerskriven/pull/529))
- **i18n:** use the security terms French and Swedish practitioners use ([#510](https://github.com/AlexaDeWit/Saerskriven/pull/510))
- **mcp:** quote the model ids read tools write into text results ([#526](https://github.com/AlexaDeWit/Saerskriven/pull/526))
- **mcp:** escape the paths and titles read tools still wrote raw ([#536](https://github.com/AlexaDeWit/Saerskriven/pull/536), [#471](https://github.com/AlexaDeWit/Saerskriven/issues/471))
- **mcp:** escape the revision a stale write refusal quotes back ([#541](https://github.com/AlexaDeWit/Saerskriven/pull/541), [#539](https://github.com/AlexaDeWit/Saerskriven/issues/539))
- **model:** cull a threat a replace takes its last element from ([#559](https://github.com/AlexaDeWit/Saerskriven/pull/559))
- **studio:** keep Title focused when M lands before the closed menu returns focus ([#469](https://github.com/AlexaDeWit/Saerskriven/pull/469))
- **studio:** name the https site in the canonical URL and sitemap ([#484](https://github.com/AlexaDeWit/Saerskriven/pull/484))
- **studio:** keep a threat's header in view when expanding it collapses one above ([#532](https://github.com/AlexaDeWit/Saerskriven/pull/532))
- **studio:** keep the menu panels off the screen edges ([#530](https://github.com/AlexaDeWit/Saerskriven/pull/530))
- **studio-e2e:** wait for menu focus before counting arrowTo's steps ([#521](https://github.com/AlexaDeWit/Saerskriven/pull/521))

### ❤️ Thank You

- Alexandra de Wit @AlexaDeWit

## 0.5.0 (2026-09-15)

### 🚀 Features

- **canvas:** mark flagged threats on the threat badge ([#429](https://github.com/AlexaDeWit/Saerskriven/pull/429))
- **formats:** read Threat Dragon mitigation text as a record and write records back ([#422](https://github.com/AlexaDeWit/Saerskriven/pull/422))
- ⚠️ **formats:** write Saerskriven YAML version 2, and read version 1 through the migration ([#431](https://github.com/AlexaDeWit/Saerskriven/pull/431))
- **formats:** import TM-BOM assumptions as assumptions that apply to the model ([#433](https://github.com/AlexaDeWit/Saerskriven/pull/433), [#407](https://github.com/AlexaDeWit/Saerskriven/issues/407))
- ⚠️ **mcp:** link, unlink and set status on records, and read records and flags ([#435](https://github.com/AlexaDeWit/Saerskriven/pull/435), [#408](https://github.com/AlexaDeWit/Saerskriven/issues/408))
- **model:** link, unlink and cull records, and derive threat flags ([#413](https://github.com/AlexaDeWit/Saerskriven/pull/413))
- **model:** add the unconfirmed assumption status ([#416](https://github.com/AlexaDeWit/Saerskriven/pull/416))
- ⚠️ **model:** link assumptions to threats only ([#417](https://github.com/AlexaDeWit/Saerskriven/pull/417))
- **model:** let an assumption apply to the model ([#426](https://github.com/AlexaDeWit/Saerskriven/pull/426))
- ⚠️ **model:** hold every mitigation as a record, and drop the threat's prose ([#428](https://github.com/AlexaDeWit/Saerskriven/pull/428))
- **model:** link a pasted threat to an identical record ([#434](https://github.com/AlexaDeWit/Saerskriven/pull/434))
- **render:** list each threat's records and flags in the register ([#418](https://github.com/AlexaDeWit/Saerskriven/pull/418), [#402](https://github.com/AlexaDeWit/Saerskriven/issues/402))
- **render:** list the assumptions that apply to the model in the register ([#427](https://github.com/AlexaDeWit/Saerskriven/pull/427))
- **studio:** edit a threat's mitigations and assumptions in the threat editor ([#421](https://github.com/AlexaDeWit/Saerskriven/pull/421))
- **studio:** show record counts and flags on the collapsed threat summary ([#430](https://github.com/AlexaDeWit/Saerskriven/pull/430), [#410](https://github.com/AlexaDeWit/Saerskriven/issues/410))
- **studio:** edit model-scoped assumptions in the model properties panel ([#438](https://github.com/AlexaDeWit/Saerskriven/pull/438))
- **studio:** open and close Model properties with the M shortcut ([#457](https://github.com/AlexaDeWit/Saerskriven/pull/457))
- **studio:** keep record rows in place when a record is added or linked ([#455](https://github.com/AlexaDeWit/Saerskriven/pull/455))
- **studio:** name each raised flag in a canvas node's accessible name ([#454](https://github.com/AlexaDeWit/Saerskriven/pull/454))
- **studio:** name the threats a shared record is on, and head the model's assumptions as the register does ([#453](https://github.com/AlexaDeWit/Saerskriven/pull/453))

### 🩹 Fixes

- **canvas:** keep a selected element's threat badge clear of its resize handle ([#458](https://github.com/AlexaDeWit/Saerskriven/pull/458))
- **studio:** keep the root menu inside a short viewport ([#420](https://github.com/AlexaDeWit/Saerskriven/pull/420))
- **studio:** keep the Link existing picker usable with long record text ([#436](https://github.com/AlexaDeWit/Saerskriven/pull/436))
- **studio:** lay out records as cards and start the link existing picker empty ([#460](https://github.com/AlexaDeWit/Saerskriven/pull/460), [#445](https://github.com/AlexaDeWit/Saerskriven/issues/445), [#439](https://github.com/AlexaDeWit/Saerskriven/issues/439))
- **studio:** bound the record announcement and keep it off the panel header ([#459](https://github.com/AlexaDeWit/Saerskriven/pull/459))
- **studio:** keep keyboard focus in the panel when undo removes a just-added threat ([#456](https://github.com/AlexaDeWit/Saerskriven/pull/456))
- **studio:** keep the threat pane's scroll position after an unlink at phone width ([#466](https://github.com/AlexaDeWit/Saerskriven/pull/466))

### ⚠️ Breaking Changes

- **mcp:** link, unlink and set status on records, and read records and flags ([#435](https://github.com/AlexaDeWit/Saerskriven/pull/435), [#408](https://github.com/AlexaDeWit/Saerskriven/issues/408))
- **formats:** write Saerskriven YAML version 2, and read version 1 through the migration ([#431](https://github.com/AlexaDeWit/Saerskriven/pull/431))
- **model:** hold every mitigation as a record, and drop the threat's prose ([#428](https://github.com/AlexaDeWit/Saerskriven/pull/428))
- **model:** link assumptions to threats only ([#417](https://github.com/AlexaDeWit/Saerskriven/pull/417))

### ❤️ Thank You

- Alexandra de Wit @AlexaDeWit

## 0.4.0 (2026-09-13)

### 🚀 Features

- **cli:** saer mcp install writes a host's registration ([#372](https://github.com/AlexaDeWit/Saerskriven/pull/372))
- **formats:** raise the readable size to 8 MiB and refuse larger writes ([#388](https://github.com/AlexaDeWit/Saerskriven/pull/388), [#374](https://github.com/AlexaDeWit/Saerskriven/issues/374))
- **mcp:** serve the model context protocol from saer mcp ([#338](https://github.com/AlexaDeWit/Saerskriven/pull/338))
- **mcp:** write models through the codec merge path ([#361](https://github.com/AlexaDeWit/Saerskriven/pull/361))
- **mcp:** read and query tools over a threat model ([#373](https://github.com/AlexaDeWit/Saerskriven/pull/373))
- **mcp:** serve Streamable HTTP on 127.0.0.1 with a bearer token ([#389](https://github.com/AlexaDeWit/Saerskriven/pull/389))
- **mcp:** add set_flow_direction and set_model_metadata edit ops ([#391](https://github.com/AlexaDeWit/Saerskriven/pull/391), [#362](https://github.com/AlexaDeWit/Saerskriven/issues/362))
- **mcp:** expose element security properties ([#393](https://github.com/AlexaDeWit/Saerskriven/pull/393), [#390](https://github.com/AlexaDeWit/Saerskriven/issues/390))
- **mcp:** serve the register and diagrams as resources, add STRIDE and review prompts ([#394](https://github.com/AlexaDeWit/Saerskriven/pull/394))
- **model:** add mitigation, assumption and diagram operations ([#332](https://github.com/AlexaDeWit/Saerskriven/pull/332))
- **render:** draw a diagram as a PNG, and render --format png ([#333](https://github.com/AlexaDeWit/Saerskriven/pull/333))
- **render:** add stable threat number anchors ([#385](https://github.com/AlexaDeWit/Saerskriven/pull/385))
- **render:** add shared themes and embeddable registers ([#387](https://github.com/AlexaDeWit/Saerskriven/pull/387))
- **studio:** join the menu, the switcher and the toolbox in one card ([#360](https://github.com/AlexaDeWit/Saerskriven/pull/360))
- **studio:** export the current diagram as a PNG ([#375](https://github.com/AlexaDeWit/Saerskriven/pull/375))
- **studio:** edit and preserve element security properties ([#386](https://github.com/AlexaDeWit/Saerskriven/pull/386))
- **wire:** declare Saerskriven YAML version 2 ([#412](https://github.com/AlexaDeWit/Saerskriven/pull/412))

### 🩹 Fixes

- **cli:** refuse an asset directory with no font face ([#346](https://github.com/AlexaDeWit/Saerskriven/pull/346))
- **cli:** hand mcp install its --file, and gate a scripted MCP session ([#392](https://github.com/AlexaDeWit/Saerskriven/pull/392))
- **mcp:** hash the target again immediately before the rename ([#370](https://github.com/AlexaDeWit/Saerskriven/pull/370))
- **studio:** keep a recovered session across an upgrade ([#350](https://github.com/AlexaDeWit/Saerskriven/pull/350))
- **studio:** let a failure notice be dismissed and fold its details ([#357](https://github.com/AlexaDeWit/Saerskriven/pull/357), [#352](https://github.com/AlexaDeWit/Saerskriven/issues/352))
- **studio:** settle two intermittent browser smoke failures ([#397](https://github.com/AlexaDeWit/Saerskriven/pull/397))
- ⚠️ **studio:** open submenus against the card so they stay on screen ([#396](https://github.com/AlexaDeWit/Saerskriven/pull/396))

### ⚠️ Breaking Changes

- **studio:** open submenus against the card so they stay on screen ([#396](https://github.com/AlexaDeWit/Saerskriven/pull/396))

### ❤️ Thank You

- Alexandra de Wit @AlexaDeWit

## 0.3.0 (2026-09-12)

### 🚀 Features

- **formats:** import an OTM bidirectional dataflow as one flow ([#324](https://github.com/AlexaDeWit/Saerskriven/pull/324))
- **model:** pin flow ends to a side and mark flows bidirectional ([#321](https://github.com/AlexaDeWit/Saerskriven/pull/321))
- **studio:** import OTM and TM-BOM as native models ([#306](https://github.com/AlexaDeWit/Saerskriven/pull/306))
- **studio:** switch between the diagrams in a model ([#322](https://github.com/AlexaDeWit/Saerskriven/pull/322))
- **studio:** follow the edits another tab makes ([#320](https://github.com/AlexaDeWit/Saerskriven/pull/320))

### 🩹 Fixes

- **studio:** trim the menu and compact shortcut alternatives ([#308](https://github.com/AlexaDeWit/Saerskriven/pull/308), [#307](https://github.com/AlexaDeWit/Saerskriven/issues/307))
- **studio:** let the inline text field stand in for the drawn text ([#326](https://github.com/AlexaDeWit/Saerskriven/pull/326))
- **studio:** keep shortcut help in one column ([#328](https://github.com/AlexaDeWit/Saerskriven/pull/328))
- **studio:** stop selection viewport snapping ([#327](https://github.com/AlexaDeWit/Saerskriven/pull/327))

### ❤️ Thank You

- Alexandra de Wit @AlexaDeWit

## 0.2.1

### Studio

- Simplify the burger menu. Duplicate, Position and size, Change flow source, Change flow target, Focus threats, and Delete selection remain available through shortcuts.
- Add right-pointing arrows to Export, Appearance, and Arrange submenu entries.
- Organize the keyboard shortcut reference into expandable categories, with two columns on wide screens and one column on narrow screens.
- Replace the threat pane's width labels with an icon button on the left. Widening or restoring the pane leaves the diagram stationary.
- Keep fitted content clear of the threat pane with both Fit to view and Fit selection.
- Enable middle-button dragging to pan in Select mode. Preserve trackpad panning and touch placement.

These changes are in [#302](https://github.com/AlexaDeWit/Saerskriven/pull/302).

### Keyboard shortcuts

- Use Command on macOS and Ctrl on Linux and Windows. macOS Redo uses Shift+Command+Z. Linux and Windows retain Ctrl+Shift+Z and Ctrl+Y.
- Keep shortcut labels, tooltips, and accessibility attributes consistent with the active platform.
- Accept the produced plus character for zoom, including Shift+Command+plus on macOS.
- Recognize shifted number-row shortcuts when the keyboard reports punctuation, including the shortcuts for changing flow endpoints.

These changes are also in [#302](https://github.com/AlexaDeWit/Saerskriven/pull/302).

### Maintenance

- Prevent missing Codecov statuses or failed uploads from blocking releases after the required repository checks pass. Pull requests retain their coverage requirements. ([#299](https://github.com/AlexaDeWit/Saerskriven/pull/299))
- Update the Nix package to the verified v0.2.0 CLI assets and retain the `saerskriven` compatibility command. ([#300](https://github.com/AlexaDeWit/Saerskriven/pull/300))
- Remove stale documentation and review artifacts. ([#298](https://github.com/AlexaDeWit/Saerskriven/pull/298))

### Upgrading

CLI arguments and model file formats are unchanged.
The Nix package keeps a separate release pin. Its update to v0.2.1 follows publication and verification of the new assets.

[Full changelog](https://github.com/AlexaDeWit/Saerskriven/compare/v0.2.0...v0.2.1)

## 0.2.0 (2026-09-08)

### Features

- **CLI:** Use `saer` as the command. The macOS and Linux installer embeds the release tag and binary SHA-256 hashes, then verifies the download before installation. Optional GitHub attestation verification checks build origin. ([#295](https://github.com/AlexaDeWit/Saerskriven/pull/295))
- **Nix:** Add the pinned CLI to downstream development shells without a separate Node, Deno, browser, or Typst installation. ([#291](https://github.com/AlexaDeWit/Saerskriven/pull/291))
- **Studio:** Copy, cut, paste, and duplicate selections. Reconnect flows, edit geometry, arrange elements, and enable snapping. Zoom controls follow the selection, and background clicks consistently clear it. ([#293](https://github.com/AlexaDeWit/Saerskriven/pull/293))
- **Threat pane:** See severity and status in collapsed summaries. Choose a wider pane for writing, keep its heading visible, and see which elements share a threat. ([#294](https://github.com/AlexaDeWit/Saerskriven/pull/294))

### Fixes

- **Studio:** Simplify menu labels and move the version badge onto the canvas. ([#292](https://github.com/AlexaDeWit/Saerskriven/pull/292))
- **Studio:** Stop delayed focus retries from closing the next element's name editor during keyboard placement. ([#296](https://github.com/AlexaDeWit/Saerskriven/pull/296))

### Release verification

- Rehearse release builds and artifact attestations on pull requests. Native Linux and macOS checks exercise installation, upgrades, compatibility links, and rejection of corrupted downloads. ([#289](https://github.com/AlexaDeWit/Saerskriven/pull/289), [#295](https://github.com/AlexaDeWit/Saerskriven/pull/295))

### Upgrading

The executable is now `saer`. The installer defaults to `~/.local/bin/saer`
and adds `saerskriven -> saer` for compatibility. It can migrate an older
`saerskriven` installation and refuses to overwrite an unrelated `saer` command.

Release downloads now use `saer-<version>-<target>` filenames, with `.exe` on
Windows. Update scripts that construct download URLs from the old filenames.
The CLI arguments remain compatible.

The Nix package keeps a separate release pin. Its update to `0.2.0` follows
publication, once the new assets and their attestations exist.

### Contributors

- Alexandra de Wit (@AlexaDeWit)

## 0.1.0 (2026-09-08)

### 🚀 Features

- project structure, shared config layer, CI, and licence ([#4](https://github.com/AlexaDeWit/Saerskriven/pull/4))
- oxlint with type-aware tsgolint as the root lint target ([#63](https://github.com/AlexaDeWit/Saerskriven/pull/63))
- oxfmt --check as the root format gate, replacing Prettier ([#65](https://github.com/AlexaDeWit/Saerskriven/pull/65))
- enforce module boundaries over the layer tags ([#66](https://github.com/AlexaDeWit/Saerskriven/pull/66))
- playwright smoke harness with nixpkgs browsers ([#69](https://github.com/AlexaDeWit/Saerskriven/pull/69))
- element and diagram schema for the model core ([#74](https://github.com/AlexaDeWit/Saerskriven/pull/74))
- threat, mitigation, and assumption schema ([#76](https://github.com/AlexaDeWit/Saerskriven/pull/76))
- parseModel boundary with cross-entity refinements ([#78](https://github.com/AlexaDeWit/Saerskriven/pull/78))
- graph edit operations for the model core ([#80](https://github.com/AlexaDeWit/Saerskriven/pull/80))
- threat operations and coverage queries for the model core ([#81](https://github.com/AlexaDeWit/Saerskriven/pull/81))
- Threat Dragon v2 read codec and the model extensions it needs ([#85](https://github.com/AlexaDeWit/Saerskriven/pull/85))
- the Panoptes YAML format and the wire package that declares it ([#90](https://github.com/AlexaDeWit/Saerskriven/pull/90))
- Threat Dragon v2 write codec and its round-trip gate ([#92](https://github.com/AlexaDeWit/Saerskriven/pull/92))
- the Threat Dragon wire schema as its own package, with its id bound ([#95](https://github.com/AlexaDeWit/Saerskriven/pull/95), [#91](https://github.com/AlexaDeWit/Saerskriven/issues/91))
- Panoptes' own threat model as the second fixture ([#108](https://github.com/AlexaDeWit/Saerskriven/pull/108), [#52](https://github.com/AlexaDeWit/Saerskriven/issues/52))
- ⚠️ rename project to Saerskriven ([#227](https://github.com/AlexaDeWit/Saerskriven/pull/227))
- **canvas:** shared SVG primitives and React Flow wrappers ([#100](https://github.com/AlexaDeWit/Saerskriven/pull/100))
- **canvas:** place flow labels where nothing else is drawn ([#115](https://github.com/AlexaDeWit/Saerskriven/pull/115))
- **canvas:** one token module, and a stylesheet generated from it ([#188](https://github.com/AlexaDeWit/Saerskriven/pull/188))
- **canvas:** a drafting-table widget language and a graph-paper ground ([#197](https://github.com/AlexaDeWit/Saerskriven/pull/197))
- **cli:** ship the CLI as a release executable, versioned by nx release ([#102](https://github.com/AlexaDeWit/Saerskriven/pull/102))
- **cli:** validate and render commands, tested against the packaged build ([#118](https://github.com/AlexaDeWit/Saerskriven/pull/118))
- **cli:** PDF of diagram plus register, compiled by Typst's WebAssembly build ([#138](https://github.com/AlexaDeWit/Saerskriven/pull/138))
- **formats:** codec contract and divergence reporting ([#83](https://github.com/AlexaDeWit/Saerskriven/pull/83))
- **formats:** detect a file's format and open it by content ([#97](https://github.com/AlexaDeWit/Saerskriven/pull/97), [#84](https://github.com/AlexaDeWit/Saerskriven/issues/84))
- **formats:** read limits and the adversarial fixtures that pin them ([#98](https://github.com/AlexaDeWit/Saerskriven/pull/98))
- **formats:** own the alias accounting the YAML read is bounded by ([#105](https://github.com/AlexaDeWit/Saerskriven/pull/105))
- **model:** ids are at least two characters, except a diagram's ([#94](https://github.com/AlexaDeWit/Saerskriven/pull/94))
- **model:** every string is text of a defined character set ([#111](https://github.com/AlexaDeWit/Saerskriven/pull/111))
- **release:** publish CLI and Pages in one workflow ([#275](https://github.com/AlexaDeWit/Saerskriven/pull/275))
- **render:** the threat register as markdown, built as mdast ([#99](https://github.com/AlexaDeWit/Saerskriven/pull/99), [#32](https://github.com/AlexaDeWit/Saerskriven/issues/32))
- **render:** a diagram as a standalone SVG document ([#104](https://github.com/AlexaDeWit/Saerskriven/pull/104))
- **studio:** model store with the undo spine ([#122](https://github.com/AlexaDeWit/Saerskriven/pull/122))
- **studio:** adopt Radix primitives and gate the studio's accessibility ([#123](https://github.com/AlexaDeWit/Saerskriven/pull/123))
- **studio:** open and save through the codecs ([#135](https://github.com/AlexaDeWit/Saerskriven/pull/135))
- **studio:** the interactive canvas, drawn from the store ([#139](https://github.com/AlexaDeWit/Saerskriven/pull/139))
- **studio:** add, connect, delete and resize on the canvas ([#153](https://github.com/AlexaDeWit/Saerskriven/pull/153))
- **studio:** edit every threat field in a panel bound to the selection ([#152](https://github.com/AlexaDeWit/Saerskriven/pull/152))
- **studio:** one command registry with a shortcut shown beside every command ([#189](https://github.com/AlexaDeWit/Saerskriven/pull/189))
- **studio:** zoom and fit in a floating cluster, and a fit on every open ([#202](https://github.com/AlexaDeWit/Saerskriven/pull/202))
- **studio:** follow the system colour scheme from the dark palette ([#205](https://github.com/AlexaDeWit/Saerskriven/pull/205))
- **studio:** a burger menu holds the file and edit commands ([#208](https://github.com/AlexaDeWit/Saerskriven/pull/208))
- **studio:** one Save as, placing the file in the format it is named in ([#221](https://github.com/AlexaDeWit/Saerskriven/pull/221))
- **studio:** overlay the threat panel on the canvas, on selection alone ([#220](https://github.com/AlexaDeWit/Saerskriven/pull/220))
- **studio:** draw connector handles from tokens and start a flow by chord ([#211](https://github.com/AlexaDeWit/Saerskriven/pull/211))
- **studio:** draw selection and hover without colour, and say what a click will do ([#218](https://github.com/AlexaDeWit/Saerskriven/pull/218))
- **studio:** open on an actor-to-store diagram sized to its words ([#214](https://github.com/AlexaDeWit/Saerskriven/pull/214))
- **studio:** rename an element or a flow in place on the canvas ([#219](https://github.com/AlexaDeWit/Saerskriven/pull/219))
- **studio:** prepare Pages for search indexing ([#231](https://github.com/AlexaDeWit/Saerskriven/pull/231))
- **studio:** link the source from the file menu ([#232](https://github.com/AlexaDeWit/Saerskriven/pull/232))
- **studio:** replace the palette with tool modes ([#229](https://github.com/AlexaDeWit/Saerskriven/pull/229))
- **studio:** export every render projection ([#234](https://github.com/AlexaDeWit/Saerskriven/pull/234))
- **studio:** preview box tool drag geometry ([#242](https://github.com/AlexaDeWit/Saerskriven/pull/242))
- **studio:** add multi-selection and group movement ([#243](https://github.com/AlexaDeWit/Saerskriven/pull/243))
- **studio:** make edit status contextual ([#240](https://github.com/AlexaDeWit/Saerskriven/pull/240))
- **studio:** add persistent colour modes ([#241](https://github.com/AlexaDeWit/Saerskriven/pull/241))
- **studio:** recover the current working session ([#260](https://github.com/AlexaDeWit/Saerskriven/pull/260))
- **studio:** publish generated social card ([#259](https://github.com/AlexaDeWit/Saerskriven/pull/259))
- **studio:** make canvas editing keys direct ([#266](https://github.com/AlexaDeWit/Saerskriven/pull/266))
- **studio:** add shortcut reference panel ([#269](https://github.com/AlexaDeWit/Saerskriven/pull/269))
- **studio:** edit flow bends on the canvas ([#277](https://github.com/AlexaDeWit/Saerskriven/pull/277), [#273](https://github.com/AlexaDeWit/Saerskriven/issues/273))
- **wire-threat-dragon:** bound summary.id as Threat Dragon's schema does ([#101](https://github.com/AlexaDeWit/Saerskriven/pull/101))

### 🩹 Fixes

- **canvas:** wrap text by grapheme cluster, not by code point ([#120](https://github.com/AlexaDeWit/Saerskriven/pull/120))
- **canvas:** place a curve boundary's name beside the curve, not on it ([#121](https://github.com/AlexaDeWit/Saerskriven/pull/121))
- **canvas:** hold a flow badge a clearance off an element badge ([#131](https://github.com/AlexaDeWit/Saerskriven/pull/131))
- **canvas:** charge a process as its circle, not its bounding square ([#144](https://github.com/AlexaDeWit/Saerskriven/pull/144))
- **canvas:** hold a curve's name clear of the curve it names ([#149](https://github.com/AlexaDeWit/Saerskriven/pull/149))
- **canvas:** draw a flow to where its element is, on every drag frame ([#187](https://github.com/AlexaDeWit/Saerskriven/pull/187))
- **canvas:** align widget geometry and labels ([#249](https://github.com/AlexaDeWit/Saerskriven/pull/249))
- **cli:** compile from a bundle stamped with a fixed modification time ([#130](https://github.com/AlexaDeWit/Saerskriven/pull/130))
- **nix:** drop inherited no-color setting ([#230](https://github.com/AlexaDeWit/Saerskriven/pull/230))
- **studio:** preserve refused drafts when closing the panel ([#224](https://github.com/AlexaDeWit/Saerskriven/pull/224))
- **studio:** keep trust boundaries behind flows ([#248](https://github.com/AlexaDeWit/Saerskriven/pull/248))
- **studio:** stabilize the initial loading state ([#252](https://github.com/AlexaDeWit/Saerskriven/pull/252))
- **studio:** keep file ownership consistent across operations ([#250](https://github.com/AlexaDeWit/Saerskriven/pull/250))
- **studio:** replace the Nx favicon ([#255](https://github.com/AlexaDeWit/Saerskriven/pull/255))
- **studio:** improve canvas interactions ([#262](https://github.com/AlexaDeWit/Saerskriven/pull/262))
- **studio:** resize elements from every side ([#261](https://github.com/AlexaDeWit/Saerskriven/pull/261))
- **studio:** ask before opening over changes ([#265](https://github.com/AlexaDeWit/Saerskriven/pull/265))
- **test:** constrain Vitest project discovery ([#235](https://github.com/AlexaDeWit/Saerskriven/pull/235))

### ⚠️ Breaking Changes

- rename project to Saerskriven ([#227](https://github.com/AlexaDeWit/Saerskriven/pull/227))
  The CLI, package scope, format name, environment variables, release files, and owned paths now use Saerskriven.

### ❤️ Thank You

- Alexandra de Wit @AlexaDeWit
