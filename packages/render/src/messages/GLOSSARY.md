# Terminology glossary

The security and threat-modelling terms Saerskriven's fr-CA and sv text uses,
the key names its shortcuts are spelled with, and where each comes from. It
covers render's catalogues in this directory and the studio's in [`apps/studio/src/messages`](../../../../apps/studio/src/messages).
A stored value of the model (a severity, a status, a category) is worded once,
in [`terms`](terms), and the studio shows the same word. A term the studio
alone uses, such as an element kind, lives in the studio's `enums` section and
follows this glossary too.

Read it before adding or rewording a term in either language. A new term with
no source is marked unconfirmed here rather than asserted.

## Rules

- **French is Canadian first.** The Office québécois de la langue française's
  Grand dictionnaire terminologique (GDT) and its risk vocabulary decide first,
  then the Canadian Centre for Cyber Security. International French usage,
  mostly Microsoft's, decides where Canada has no settled term.
- **Swedish follows MSB.** MSB's method support for information security,
  which quotes SS-EN ISO/IEC 27000, decides first. Lund University's
  information-security terminology and practitioner usage decide where MSB is
  silent. Microsoft's Swedish pages are machine translated, so they show which
  words are in circulation and decide nothing alone.
- **Agreement.** An adjective agrees with the noun it qualifies, in gender and
  number. A severity qualifies the severity field (fr `gravité`, feminine, sv
  `allvarlighetsgrad`, common gender), a threat status the threat (fr
  `menace`, feminine, sv `hot`, neuter), a mitigation status the mitigation (fr
  `mesure`, feminine, sv `åtgärd`, common gender), and an assumption status the
  assumption (fr `hypothèse`, feminine, sv `antagande`, neuter). `Risque
accepté` and `Accepterad risk` are noun phrases and agree with `risque` and
  `risk`.
- **Methodology names stay as written.** `STRIDE`, `LINDDUN`, `CIA`,
  `CIA-DIE` and `PLOT4ai` are the model's stored identifiers, and a register
  prints one in parentheses after the category, so a reader can look the
  methodology up under its own name. A French or Swedish acronym for the CIA
  triad does not replace the stored name. The category labels
  within a methodology are translated: Microsoft's French training titles its
  STRIDE units "Spoofing (usurpation d'identité)" and "Tampering
  (falsification)", pairing the English name with the French term, and the
  register's parentheses do the same job with the methodology name. The
  Elevation of Privilege card game keeps its English name.
- **Badge marks** are one grapheme each and differ within a locale. fr-CA
  marks high severity `É`, from `Élevée`.
- **French typography.** The apostrophe is the typographic `’` in every
  catalogue. A colon takes a plain space before it, and guillemets take
  no-break spaces inside them.

## Terms

`Changed` names the word this glossary replaced. A blank cell means the
earlier wording stands.

### The threat model

| English          | fr-CA                    | sv                 | Changed                          | Sources                                                                      |
| ---------------- | ------------------------ | ------------------ | -------------------------------- | ---------------------------------------------------------------------------- |
| threat           | menace (f.)              | hot (neuter)       |                                  | [OQLF risk vocabulary][oqlf-risk], [MSB: riskhantering][msb-riskhantering]   |
| threat modelling | modélisation des menaces | hotmodellering     |                                  | [Microsoft fr: Threat Modeling Tool][ms-fr-start], [Microsoft sv][ms-sv-dfd] |
| mitigation       | mesure (f.)              | åtgärd (common)    |                                  | [OQLF risk vocabulary][oqlf-risk], [Lund terminology][lund]                  |
| assumption       | hypothèse (f.)           | antagande (neuter) |                                  | unconfirmed as a term of art, ordinary usage in both languages               |
| severity         | gravité (f.)             | allvarlighetsgrad  | sv `allvarlighet`, `allvarsgrad` | [OQLF risk vocabulary][oqlf-risk], [Dell sv][dell-sv]                        |

- **mitigation:** the OQLF advises against `mitigation` as a calque and gives
  `atténuation` ("on évitera ce calque de l'anglais"). The full term is
  `mesure d'atténuation`, which the same vocabulary uses. The catalogues keep
  the short `mesure`, as Swedish keeps `åtgärd` for Lund's
  `åtgärd/säkerhetsåtgärd`, because a threat's record group and its status
  (`Atténuée`) already say what the measure is for.
- **severity:** the OQLF risk vocabulary gives `gravité du risque` for
  "risk severity". `sévérité` is rejected: the OQLF
  [discourages `sévère`][oqlf-severe] in the sense of "grave" as a borrowing
  from English. In Swedish, `allvarlighetsgrad` is the word vendors
  use for the CVSS scale (Dell: "en kvalitativ representation av
  allvarlighetsgraden (dvs. antingen kritisk, hög, medelhög eller låg)").
  `Allvarlighet` names the quality rather than the rating, and `allvarsgrad`
  appeared in one studio section only.

### Severity levels

| English   | fr-CA        | sv       | Sources                                                   |
| --------- | ------------ | -------- | --------------------------------------------------------- |
| Low       | Faible       | Låg      | [AWS Inspector fr][aws-fr], [Dell sv][dell-sv]            |
| Medium    | Moyenne      | Medel    | [AWS Inspector fr][aws-fr]. Dell sv writes `medelhög`     |
| High      | Élevée       | Hög      | [AWS Inspector fr][aws-fr], [Dell sv][dell-sv]            |
| Critical  | Critique     | Kritisk  | [AWS Inspector fr][aws-fr], [Dell sv][dell-sv]            |
| Undecided | Indéterminée | Obestämd | unconfirmed: no scale in either language names this state |

### Threat status

| English        | fr-CA          | sv              | Sources                                                              |
| -------------- | -------------- | --------------- | -------------------------------------------------------------------- |
| Open           | Ouverte        | Öppet           | ordinary usage                                                       |
| Mitigated      | Atténuée       | Åtgärdat        | [OQLF risk vocabulary][oqlf-risk], [MSB: riskanalys][msb-riskanalys] |
| Transferred    | Transférée     | Överfört        | [OQLF risk vocabulary][oqlf-risk], [MSB: riskanalys][msb-riskanalys] |
| Avoided        | Évitée         | Undviket        | [OQLF risk vocabulary][oqlf-risk], [MSB: riskanalys][msb-riskanalys] |
| Accepted risk  | Risque accepté | Accepterad risk | [OQLF risk vocabulary][oqlf-risk], [MSB: riskanalys][msb-riskanalys] |
| Eliminated     | Éliminée       | Eliminerat      | [MSB: riskanalys][msb-riskanalys]                                    |
| Not applicable | Sans objet     | Ej tillämpligt  | [GDT: sans objet][gdt-sans-objet], [Microsoft sv][ms-sv-start]       |

- **Mitigated:** Microsoft's French tool writes `Mitigé`, the calque the OQLF
  rejects. MSB's verb is `reducera`, and `Åtgärdat` is kept because the status
  says a mitigation was applied, not how far the risk fell.
- **Not applicable:** the GDT lists `N/A` and `NA` as terms to avoid, and
  Microsoft's French `Non applicable` is the anglicized form.

### Mitigation and assumption status

| English     | fr-CA         | sv               | Sources                                                            |
| ----------- | ------------- | ---------------- | ------------------------------------------------------------------ |
| Proposed    | Proposée      | Föreslagen       | ordinary usage                                                     |
| Implemented | Mise en œuvre | Införd           | [MSB: riskanalys][msb-riskanalys] ("införa ... säkerhetsåtgärder") |
| Verified    | Vérifiée      | Verifierad       | ordinary usage                                                     |
| Unconfirmed | Non confirmée | Obekräftat       | unconfirmed as a term of art                                       |
| Valid       | Valide        | Giltigt          | unconfirmed as a term of art                                       |
| Invalidated | Invalidée     | Ogiltigförklarat | unconfirmed as a term of art                                       |

### Diagram elements

| English        | fr-CA                       | sv                       | Changed                            | Sources                                                                       |
| -------------- | --------------------------- | ------------------------ | ---------------------------------- | ----------------------------------------------------------------------------- |
| actor          | acteur (m.)                 | aktör (common)           |                                    | see the note                                                                  |
| process        | processus (m.)              | process (common)         |                                    | [Microsoft fr][ms-fr-dfd], [Microsoft sv][ms-sv-dfd]                          |
| data store     | magasin de données (m.)     | datalager (neuter)       | fr `entrepôt`, `dépôt`, sv `lager` | [Microsoft fr][ms-fr-dfd], [Microsoft sv][ms-sv-dfd]                          |
| data flow      | flux (m.)                   | flöde (neuter)           |                                    | [Microsoft fr][ms-fr-dfd], [Microsoft sv][ms-sv-dfd]                          |
| trust boundary | frontière de confiance (f.) | förtroendegräns (common) |                                    | [WeeSec][weesec], [Microsoft sv][ms-sv-dfd], [Microsoft sv][ms-sv-start]      |
| trust zone     | zone de confiance           | förtroendezon            | sv `tillitszon`                    | [Microsoft fr][ms-fr-dfd], [Microsoft sv][ms-sv-dfd] ("förtroendezonändring") |

- **actor:** the data-flow-diagram literature calls this element an external
  entity (fr `entité externe`, sv `extern entitet`). Saerskriven's English
  calls it an actor, so both catalogues translate the English word. Moving to
  the external-entity term is a change to the English too.
- **data store:** Microsoft's French data-flow-diagram module titles the
  element's unit "Magasin de données - Élément de stockage". The GDT has no
  entry for the diagram element. Its [`magasin de données`][gdt-magasin] is
  the entry for an operational data store (ODS), a data-warehousing concept
  that lists "data store" only as an English synonym and prefers to keep the
  French term for ODS. The same field sets `entrepôt de données` apart as the
  data warehouse, so `entrepôt` misleads a French reader, and `dépôt` has no
  GDT entry in this sense. Swedish `lager` alone reads as stock or layer, and
  Microsoft's Swedish module names the element `Datalager`.
- **log store:** the studio's log-store flag is fr `Dépôt de journaux` and sv
  `Logglager`. French keeps `dépôt` here by the maintainer's ruling:
  `magasin de journaux` reads as a newspaper shop, and a log store is a place
  logs are deposited rather than a data-flow-diagram element.
- **trust boundary:** French practice writes both `frontière de confiance`
  ([WeeSec][weesec]: "Identification des frontières de confiance (trust
  boundaries)") and `limite de confiance` (Microsoft's French data-flow-diagram
  module, and [Stéphane Robert][stephane-robert], who uses both). Neither has a
  GDT or TERMIUM entry in this sense. `frontière` is kept because the GDT
  already gives [`limite de confiance`][gdt-limite] to statistics, as a
  confidence limit, and a register that sits beside risk figures should not
  borrow it. Microsoft's older [Threat Modeling Tool page][ms-fr-start] writes
  `limites d'approbation`, following its own translation of "trust" as
  `approbation`, and its newer training has dropped it. The trust zone is
  `zone de confiance` in the same module. Swedish Microsoft pages write
  `förtroendegränser`. In
  Swedish, `förtroendegräns` and `förtroendezon` share a stem, as the English
  pair does.
- **data flow:** the short form stands on the canvas, where the element is
  always a data flow. The full forms are fr `flux de données` and sv
  `dataflöde`.

### STRIDE

| English                | fr-CA                      | sv                    | Changed                            | Sources                                                            |
| ---------------------- | -------------------------- | --------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| Spoofing               | Usurpation d’identité      | Förfalskning          | fr `Usurpation`                    | [Microsoft fr][ms-fr-start], [Microsoft fr training][ms-fr-stride] |
| Tampering              | Falsification              | Manipulering          | fr `Altération`, sv `Manipulation` | [Microsoft fr][ms-fr-start], [Advania][advania]                    |
| Repudiation            | Répudiation                | Förnekande            |                                    | [Microsoft fr][ms-fr-start], [Advania][advania]                    |
| Information disclosure | Divulgation d’informations | Informationsläckage   | fr `Divulgation d’information`     | [Microsoft fr][ms-fr-start], [Advania][advania]                    |
| Denial of service      | Déni de service            | Överbelastningsattack | sv `Överbelastning`                | [Microsoft fr][ms-fr-start], [Lund terminology][lund]              |
| Elevation of privilege | Élévation de privilèges    | Behörighetseskalering | sv `Utökade rättigheter`           | [Microsoft fr][ms-fr-start], [Advania][advania]                    |

- **Spoofing:** bare `usurpation` names the act without its object. Microsoft
  and French practitioners write `usurpation d'identité`. Swedish
  `identitetsstöld` (Advania) means identity theft, which is narrower, so
  `Förfalskning` stands.
- **Tampering:** Microsoft and [OWASP Threat Dragon's French][td-fr] write
  `falsification`, and `altération` is the word for the damage rather than
  the attack.
- **Information disclosure:** Microsoft writes the plural `divulgation
d'informations`. Threat Dragon's French writes the singular. The plural is
  kept, since a disclosure rarely concerns one item.
- **Denial of service:** Lund gives "Denial of Service attack
  (överbelastningsattack, tillgänglighetsattack)". [Advania][advania] glosses
  it as "Denial of Service (överbelastning)". Lund wins because it is an
  institution's reviewed terminology rather than a vendor glossary, and
  because bare `överbelastning` is the load, not the attack, so a STRIDE label
  naming a threat needs the `-attack`.
- **Elevation of privilege:** `Utökade rättigheter` names the state an
  attacker ends in rather than the threat. `Behörighetseskalering` is
  Advania's term and matches the studio's `Behörighetsnivå` for privilege
  level. Microsoft's Swedish pages vary (`utökade privilegier`,
  `behörighetshöjning`) and are machine translated.

### LINDDUN

No French or Swedish translation of LINDDUN was found:
[linddun.org][linddun] publishes the threat types in English only. The labels
are Saerskriven's own, chosen as the plain word for each threat type.

| English         | fr-CA                  | sv                    | Changed              | Sources                  |
| --------------- | ---------------------- | --------------------- | -------------------- | ------------------------ |
| Linking         | Association            | Länkning              |                      | unconfirmed              |
| Identifying     | Identification         | Identifiering         |                      | unconfirmed              |
| Non-repudiation | Non-répudiation        | Oavvislighet          | sv `Icke-förnekande` | [Lund terminology][lund] |
| Detecting       | Détection              | Upptäckt              |                      | unconfirmed              |
| Data disclosure | Divulgation de données | Dataläckage           |                      | unconfirmed              |
| Unawareness     | Méconnaissance         | Ovetskap              |                      | unconfirmed              |
| Non-compliance  | Non-conformité         | Bristande efterlevnad |                      | unconfirmed              |

- **Non-repudiation:** Lund defines `oavvislighet` as "Att en handling inte i
  efterhand ska kunna förnekas av utföraren". `Icke-förnekande` was a
  word-for-word rendering.

### CIA and CIA-DIE

| English         | fr-CA           | sv               | Changed         | Sources                                                          |
| --------------- | --------------- | ---------------- | --------------- | ---------------------------------------------------------------- |
| Confidentiality | Confidentialité | Konfidentialitet |                 | [MSB: klassningsmodell][msb-klassning]                           |
| Integrity       | Intégrité       | Riktighet        | sv `Integritet` | [MSB: klassningsmodell][msb-klassning], [Lund terminology][lund] |
| Availability    | Disponibilité   | Tillgänglighet   |                 | [MSB: klassningsmodell][msb-klassning]                           |
| Distributed     | Distribuée      | Distribuerad     |                 | unconfirmed                                                      |
| Immutable       | Immuable        | Oföränderlig     |                 | unconfirmed                                                      |
| Ephemeral       | Éphémère        | Kortlivad        |                 | unconfirmed                                                      |

- **Integrity:** MSB, quoting SS-EN ISO/IEC 27000, defines `riktighet` as
  "egenskap som innebär att vara korrekt och fullständig". Swedish
  `integritet` reads as personal privacy (`personlig integritet`), and the
  PLOT4ai category `Integritet och dataskydd` uses it in that sense.
- **DIE:** the triad has no standard French or Swedish wording. The
  adjectives agree with fr `catégorie` and sv `kategori`, both feminine or
  common gender.

### PLOT4ai

[PLOT4ai][plot4ai] publishes its library in English only, and no French or
Swedish edition was found. The eight category labels are Saerskriven's own
and unconfirmed.

### Other terms

| English         | fr-CA                    | sv                      | Changed           | Sources                                                           |
| --------------- | ------------------------ | ----------------------- | ----------------- | ----------------------------------------------------------------- |
| privilege level | niveau de privilège      | behörighetsnivå         |                   | [Lund terminology][lund] (`behörighet`), exact phrase unconfirmed |
| credentials     | justificatifs d’identité | autentiseringsuppgifter | fr `identifiants` | [CCCS: GIJIA][cccs-gijia], [CERT-SE][cert-se-v13]                 |
| authentication  | authentification         | autentisering           |                   | [Lund terminology][lund]                                          |
| protocol        | protocole                | protokoll               |                   | ordinary usage                                                    |

- **credentials:** in the GDT's usage an `identifiant` is the user name alone,
  one part of a credential. The Canadian Centre for Cyber Security writes
  `justificatifs d'identité`.

### Key names

The studio spells a shortcut from these names, in its menus, its shortcut
reference, its tooltips and the text a screen reader reads out
([`commands` section](../../../../apps/studio/src/messages/commands)). A
chord joins them with `+` in every locale, as Microsoft's guides do
(`Ctrl+Maj+Suppr`, `Alt+Blanksteg`). A letter, a digit, a punctuation key and
a function key (`S`, `0`, `?`, `F1`) are written as the key cap prints them.
`aria-keyshortcuts` keeps the key values the attribute requires
(`Control+Shift+S`) in every language.

| English     | en-CA       | fr-CA          | sv         | Sources                                                                                                                |
| ----------- | ----------- | -------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| Ctrl        | Ctrl        | Ctrl           | Ctrl       | [Microsoft en][ms-en-keys], [Microsoft fr-CA guide][ms-fr-ca-guide], [Microsoft sv guide][ms-sv-guide]                 |
| Shift       | Shift       | Maj            | Skift      | [Microsoft fr-CA guide][ms-fr-ca-guide], [Microsoft sv guide][ms-sv-guide], [Apple fr][apple-fr], [Apple sv][apple-sv] |
| Backspace   | Backspace   | Retour arrière | Backsteg   | [Microsoft fr-CA guide][ms-fr-ca-guide], [Microsoft sv guide][ms-sv-guide]                                             |
| Delete      | Delete      | Suppr          | Delete     | [Microsoft fr-CA guide][ms-fr-ca-guide], [GDT: touche Suppression][gdt-suppr], [Microsoft sv guide][ms-sv-guide]       |
| Esc         | Esc         | Échap          | Esc        | [Microsoft fr-CA guide][ms-fr-ca-guide], [GDT: touche d’échappement][gdt-echap], [Microsoft sv guide][ms-sv-guide]     |
| Tab         | Tab         | Tab            | Tabb       | [Microsoft fr-CA guide][ms-fr-ca-guide], [GDT: touche de tabulation][gdt-tab], [Microsoft sv guide][ms-sv-guide]       |
| Enter       | Enter       | Entrée         | Retur      | [Microsoft fr-CA guide][ms-fr-ca-guide], [Microsoft sv guide][ms-sv-guide]                                             |
| Spacebar    | Spacebar    | Espace         | Blanksteg  | [Microsoft fr-CA guide][ms-fr-ca-guide] (in its shortcut table), [Microsoft sv guide][ms-sv-guide]                     |
| Up arrow    | Up arrow    | Flèche haut    | Uppåtpil   | [Microsoft fr-CA Windows][ms-fr-ca-windows], [Microsoft sv guide][ms-sv-guide]                                         |
| Right arrow | Right arrow | Flèche droite  | Högerpil   | [Microsoft fr-CA Windows][ms-fr-ca-windows], [Microsoft sv guide][ms-sv-guide]                                         |
| Down arrow  | Down arrow  | Flèche bas     | Nedåtpil   | [Microsoft fr-CA Windows][ms-fr-ca-windows], [Microsoft sv guide][ms-sv-guide]                                         |
| Left arrow  | Left arrow  | Flèche gauche  | Vänsterpil | [Microsoft fr-CA Windows][ms-fr-ca-windows], [Microsoft sv guide][ms-sv-guide]                                         |
| Page up     | Page up     | Pg préc        | Page Up    | [Microsoft fr-CA guide][ms-fr-ca-guide], [Microsoft sv guide][ms-sv-guide]                                             |
| Page down   | Page down   | Pg suiv        | Page Down  | [Microsoft fr-CA guide][ms-fr-ca-guide], [Microsoft sv guide][ms-sv-guide]                                             |

- **One name, shown and spoken.** The chord a person reads and the chord a
  screen reader reads out use the same name. Microsoft's localization guides
  give one name per key, and no source was found for a separate, fuller
  spoken set. The name is the one a sighted helper finds on the key.
- **Microsoft's guides decide.** Microsoft's Canadian French and Swedish
  localization style guides each list the key names (section "Keys") and the
  standard shortcuts written with them, and its [France French
  guide][ms-fr-fr-guide] lists the same French names. They are guidance for
  translators rather than translated pages. The Canadian multilingual standard
  keyboard, CAN/CSA Z243.200-92, arranges the alphanumeric keys only and does
  not fix the words printed on the others ([CAN/CSA Z243.200][csa-wiki]), so it decides nothing here.
- **Ctrl:** both French guides ([fr-CA][ms-fr-ca-guide],
  [fr-FR][ms-fr-fr-guide]) list `Control` as the key's name, and both write
  `Ctrl` in every shortcut they give (`Ctrl+Maj+Suppr`, `Ctrl+Échap`).
  A chord is a shortcut, so fr-CA writes `Ctrl`, as Microsoft's fr-CA Windows
  shortcut page does.
- **Échap, Suppr, Tab:** the GDT lists `Échap.`, `Suppr.` and `touche Tab.`
  with a period, and notes that `Échap.` breaks the classical rule, which asks
  for `Échapp.`. The catalogues write the key-cap form without a period, as
  Microsoft's guides do, since a period inside `Ctrl+Échap.` reads as the end
  of a sentence. Apple's French keyboard page lists the keys as
  `Esc (échappement)` and `Supprimer`. The GDT has no abbreviation
  for the Shift key: its entry is `touche Majuscule`, and `Maj` is Microsoft's.
- **Arrows:** Microsoft's French guides ([fr-CA][ms-fr-ca-guide],
  [fr-FR][ms-fr-fr-guide]) name the arrows `Haut`, `Bas`, `Gauche` and
  `Droite`. Microsoft's fr-CA Windows shortcut page mostly writes
  `Flèche haut`, `Flèche bas`, `Flèche gauche` and `Flèche droite`, with
  `Flèche vers le haut` and `Flèche vers le bas` in a few places, and Apple's
  page writes `Flèche de gauche`.
  The catalogues follow the Windows page, since a key reference that lists a
  bare `Gauche` does not say which key it means, and the studio's existing
  `Maj+Flèche` and `Touches fléchées` already say `Flèche`. Prose that names
  two directions together, such as `Gauche/Droite pour choisir`, keeps the
  short form.
- **Espace:** both French guides name the key `Barre d’espace` and write
  `Alt+Espace` in their shortcut tables. A chord takes `Espace`.
- **Swedish Delete, Page Up:** the Swedish guide keeps `Delete`, `Page Up` and
  `Page Down` in English, and so do the catalogues. Microsoft's
  [sv Windows shortcut page][ms-sv-windows] also writes `Del` and `PgUp`.
- **English:** Microsoft's English style guide writes `Esc` ("Always use Esc,
  not Escape"), `Spacebar`, and the arrows and page keys in sentence case,
  which en-CA follows. The studio's prose says `Esc` wherever it names the key.
- **Apple hardware:** on a Mac, the studio writes the modifiers as Apple's
  symbols `⇧` and `⌘`, before the key and without a `+`. Apple's keyboard
  pages list the same symbols for those modifiers in every language
  ([Apple fr][apple-fr], [Apple sv][apple-sv]).
  The named keys use the table above on every platform. Apple's pages name
  some of them differently (fr `Retour` and `Supprimer`, sv `Radera` for the
  key Microsoft calls Backspace), and the studio does not yet tell those
  apart.
- **Unconfirmed:** what Swedish and Canadian French keyboards print on their
  keys. No manufacturer's or standards body's list was found, and many print
  English words or ISO/IEC 9995-7 symbols.

## Sources

[gdt-magasin]: https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/8372295/magasin-de-donnees
[gdt-sans-objet]: https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/18932447/sans-objet
[oqlf-severe]: https://vitrinelinguistique.oqlf.gouv.qc.ca/22820/les-emprunts-a-langlais/emprunts-semantiques/emploi-deconseille-de-lemprunt-severe
[oqlf-risk]: https://www.oqlf.gouv.qc.ca/ressources/bibliotheque/dictionnaires/terminologie_risque/Vocabulaire_gestion_risque04.pdf
[cccs-gijia]: https://www.cyber.gc.ca/fr/orientation/gestion-de-lidentite-des-justificatifs-didentite-et-de-lacces-gijia-itsap30018
[ms-fr-start]: https://learn.microsoft.com/fr-fr/azure/security/develop/threat-modeling-tool-getting-started
[ms-fr-dfd]: https://learn.microsoft.com/fr-fr/training/modules/tm-create-a-threat-model-using-foundational-data-flow-diagram-elements/
[ms-fr-stride]: https://learn.microsoft.com/fr-fr/training/modules/tm-use-a-framework-to-identify-threats-and-find-ways-to-reduce-or-eliminate-risk/
[gdt-limite]: https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/507686/limite-de-confiance
[weesec]: https://www.weesec.com/threat-modeling/
[stephane-robert]: https://blog.stephane-robert.info/docs/devops/fondamentaux/threat-modeling-stride/
[td-fr]: https://github.com/OWASP/threat-dragon/blob/main/td.vue/src/i18n/fr.json
[aws-fr]: https://docs.aws.amazon.com/fr_fr/inspector/latest/user/findings-understanding-severity.html
[msb-klassning]: https://metodstod-informationssakerhet.msb.se/sv/utforma/klassningsmodell/
[msb-riskanalys]: https://metodstod-informationssakerhet.msb.se/sv/anvanda/riskanalys/
[msb-riskhantering]: https://metodstod-informationssakerhet.msb.se/sv/utforma/riskhantering
[lund]: https://www.medarbetarwebben.lu.se/sites/medarbetarwebben.lu.se/files/2021-08/Terminologi%20inom%20informationssa%CC%88kerhetsomra%CC%8Adet%20%20LU%20-%20Rev%202.0%20210622.pdf
[ms-sv-dfd]: https://learn.microsoft.com/sv-se/training/modules/tm-create-a-threat-model-using-foundational-data-flow-diagram-elements/
[ms-sv-start]: https://learn.microsoft.com/sv-se/azure/security/develop/threat-modeling-tool-getting-started
[advania]: https://www.advania.se/ordforradet/threat-modeling
[dell-sv]: https://www.dell.com/support/contents/sv-se/article/product-support/self-support-knowledgebase/security-antivirus/alerts-vulnerabilities/dell-vulnerability-response-policy
[cert-se-v13]: https://www.cert.se/2026/03/cert-se-veckobrev-v13.html
[linddun]: https://linddun.org/threat-types/
[plot4ai]: https://plot4.ai/library
[ms-en-keys]: https://learn.microsoft.com/en-us/style-guide/a-z-word-list-term-collections/term-collections/keys-keyboard-shortcuts
[ms-fr-ca-guide]: https://download.microsoft.com/download/5/6/8/568628ff-0646-4740-a052-d8bd97ecdcf8/fra-can-StyleGuide.pdf
[ms-sv-guide]: https://download.microsoft.com/download/5/0/9/5095f52b-dd67-4951-9afa-c15bb1696a4a/swe-swe-StyleGuide.pdf
[ms-fr-fr-guide]: https://download.microsoft.com/download/c/7/9/c7921dbd-4531-4a4e-8490-e4656d739f3d/fra-fra-StyleGuide.pdf
[ms-sv-windows]: https://support.microsoft.com/sv-se/windows/keyboard-shortcuts-in-windows-dcc61a57-8ff0-cffe-9796-cb9706c75eec
[ms-fr-ca-windows]: https://support.microsoft.com/fr-ca/windows/keyboard-shortcuts-in-windows-dcc61a57-8ff0-cffe-9796-cb9706c75eec
[apple-fr]: https://support.apple.com/fr-ca/102650
[apple-sv]: https://support.apple.com/sv-se/102650
[gdt-echap]: https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/2089264/touche-dechappement
[gdt-suppr]: https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/8392725/touche-suppression
[gdt-tab]: https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/8392699/touche-de-tabulation
[csa-wiki]: https://fr.wikipedia.org/wiki/CAN/CSA_Z243.200

Also checked, with nothing to cite:

- **NCSC-SE** ([ncsc.se](https://www.ncsc.se/sv/)) publishes general
  security guidance and nothing on threat modelling, STRIDE or
  data-flow diagrams, so no Swedish term here rests on it.
- **OWASP** publishes its threat-modelling material in English. Its Québec
  City chapter titles talks "modélisation des menaces", which matches the
  catalogues. [OWASP Threat Dragon][td-fr] ships a French locale, cited above
  for STRIDE, and no Swedish one. Its French LINDDUN labels (`Capacité de
liaison`, `Identifiabilité`, `Détectabilité`, `Inconscience`) follow the
  older LINDDUN names this model does not use, and its status labels are
  partly untranslated, so it is not cited for either.

Microsoft's French and Swedish pages cited here are marked as machine
translated. They are cited for the words in circulation, never alone.
