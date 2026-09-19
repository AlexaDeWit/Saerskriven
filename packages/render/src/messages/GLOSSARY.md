# Terminology glossary

The security and threat-modelling terms Saerskriven's fr-CA and sv text uses,
and where each comes from. It covers render's catalogues in this directory and
the studio's in [`apps/studio/src/messages`](../../../../apps/studio/src/messages).
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

| English        | fr-CA                       | sv                       | Changed                            | Sources                                                                |
| -------------- | --------------------------- | ------------------------ | ---------------------------------- | ---------------------------------------------------------------------- |
| actor          | acteur (m.)                 | aktör (common)           |                                    | see the note                                                           |
| process        | processus (m.)              | process (common)         |                                    | [Microsoft fr][ms-fr-start], [Microsoft sv][ms-sv-dfd]                 |
| data store     | magasin de données (m.)     | datalager (neuter)       | fr `entrepôt`, `dépôt`, sv `lager` | [GDT: magasin de données][gdt-magasin], [Microsoft sv][ms-sv-dfd]      |
| data flow      | flux (m.)                   | flöde (neuter)           |                                    | [Microsoft fr][ms-fr-start], [Microsoft sv][ms-sv-dfd]                 |
| trust boundary | frontière de confiance (f.) | förtroendegräns (common) |                                    | [Microsoft sv][ms-sv-dfd], [Microsoft sv][ms-sv-start], fr unconfirmed |
| trust zone     | zone de confiance           | förtroendezon            | sv `tillitszon`                    | [Microsoft sv][ms-sv-dfd] ("förtroendezonändring"), fr unconfirmed     |

- **actor:** the data-flow-diagram literature calls this element an external
  entity (fr `entité externe`, sv `extern entitet`). Saerskriven's English
  calls it an actor, so both catalogues translate the English word. Moving to
  the external-entity term is a change to the English too.
- **data store:** the GDT gives `magasin de données` for "data store" and
  keeps `entrepôt de données` for a data warehouse, so `entrepôt` misleads a
  French reader. `dépôt` has no GDT entry in this sense. Swedish `lager` alone
  reads as stock or layer, and Microsoft's Swedish module names the element
  `Datalager`. The studio's log-store flag follows: fr `Magasin de journaux`,
  sv `Logglager`.
- **trust boundary:** Microsoft's French writes `limites d'approbation`,
  following its own translation of "trust" as `approbation`, which French
  security writing outside Microsoft does not use. `frontière de confiance`
  has no GDT or TERMIUM entry in this sense and is unconfirmed from an
  authority. Swedish Microsoft pages write `förtroendegränser`. In
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
- **Tampering:** Microsoft writes `falsification`, and `altération` is the
  word for the damage rather than the attack.
- **Denial of service:** Lund gives "Denial of Service attack
  (överbelastningsattack, tillgänglighetsattack)". Bare `överbelastning` is
  the load, not the attack.
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

## Sources

[gdt-magasin]: https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/8372295/magasin-de-donnees
[gdt-sans-objet]: https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/18932447/sans-objet
[oqlf-severe]: https://vitrinelinguistique.oqlf.gouv.qc.ca/22820/les-emprunts-a-langlais/emprunts-semantiques/emploi-deconseille-de-lemprunt-severe
[oqlf-risk]: https://www.oqlf.gouv.qc.ca/ressources/bibliotheque/dictionnaires/terminologie_risque/Vocabulaire_gestion_risque04.pdf
[cccs-gijia]: https://www.cyber.gc.ca/fr/orientation/gestion-de-lidentite-des-justificatifs-didentite-et-de-lacces-gijia-itsap30018
[ms-fr-start]: https://learn.microsoft.com/fr-fr/azure/security/develop/threat-modeling-tool-getting-started
[ms-fr-stride]: https://learn.microsoft.com/fr-fr/training/modules/tm-use-a-framework-to-identify-threats-and-find-ways-to-reduce-or-eliminate-risk/
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

Microsoft's French and Swedish pages cited here are marked as machine
translated. They are cited for the words in circulation, never alone.
