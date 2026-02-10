# UBJH Articles & Publication System Report

## Overview
The University of Benin Journal of Humanities (UBJH) server implements a comprehensive publication system that bridges the gap between manuscript submission/review and public access. The system supports both a rigorous peer-review workflow and a manual bypass mechanism for legacy or special publications.

## Modes of Publication

There are two primary ways an article enters the system:

### 1. Standard Peer-Review Workflow
This is the default path for new submissions.
1.  **Submission**: Author submits a manuscript (`Manuscript` model).
2.  **Review**: Manuscript undergoes peer review (Human or AI).
3.  **Decision**: Admin reviews the feedback and makes a final decision.
4.  **Approval & Article Creation**:
    *   When an Admin sets the status to `APPROVED` via `DecisionsController`, an `Article` record is automatically created.
    *   **Note**: The article is created with `isPublished: false` at this stage. It is "ready for publication" but not yet visible to the public.
5.  **Publication**:
    *   Admin selects the pending article via the **Publication Manager**.
    *   Admin assigns it to a specific **Volume** and **Issue**.
    *   Admin sets page numbers and final details.
    *   The system marks the article as `isPublished: true`, registers a DOI, and triggers indexing jobs.

### 2. Manual Creation (Bypass / Fast-Track)
Designed for migrating legacy articles or publishing non-peer-reviewed content (e.g., Editorials needing quick turnaround).
*   **Controller**: `PublicationController.createAndPublishManualArticle`
*   **Process**:
    *   Admin provides all metadata (Title, Abstract, Author, PDF, etc.) directly.
    *   Admin selects Volume and Issue immediately.
    *   **Result**: An `Article` is created and effectively published immediately, completely bypassing the `Manuscript` submission and `Review` system.
    *   **Use Case**: Migrating old journal archives or correcting missing records.

### 3. Admin Override (Edge Case)
*   **Controller**: `OverrideDecisionController`
*   **Function**: Allows an admin to force-change a manuscript's status (e.g., to `APPROVED`) without passing validation checks.
*   **Caveat**: Unlike the standard decision process, the current override implementation **does not automatically create an Article record**. It only updates the status string on the Manuscript. This is primarily for fixing stuck workflow states rather than a publication method.

## Indexing & External Integrations

The system is built to maximize research visibility through several automated integrations:

### 1. Crossref (DOI)
*   **Service**: `CrossrefService` (`src/Publication/services/crossref.service.ts`)
*   **Function**:
    *   Mints DOIs using the prefix `10.xxxx/ubjh.{year}.{vol}.{issue}.{seq}`.
    *   Generates Crossref-compliant XML metadata.
    *   Registers the DOI automatically upon publication.
*   **Status Tracking**: Tracks `pending`, `registered`, or `failed` states.

### 2. Google Scholar
*   **Service**: `IndexingService` (`src/Publication/services/indexing.service.ts`)
*   **Function**: Injects standard `citation_*` meta tags into the article's public page HTML.
*   **Tags Included**: Title, Author, Publication Date, PDF URL, Volume, Issue, ISSN.

### 3. BASE / CORE (OAI-PMH)
*   **Service**: `IndexingService`
*   **Function**: Generates OAI-PMH compliant XML records.
*   **Metadata**: Dubin Core (`dc:*`) format including title, creator, subject, description, and rights.

### 4. Internet Archive
*   **Service**: `InternetArchiveService` (`src/Publication/services/internetArchive.service.ts`)
*   **Function**:
    *   Uploads the final PDF to the Internet Archive's S3-compatible storage.
    *   Preserves the content permanently ensuring long-term accessibility.
    *   Sets metadata like collection (opensource), mediatype (texts), and license (CC BY 4.0).

### 5. SEO (JSON-LD)
*   **Service**: `IndexingService`
*   **Function**: Generates `ScholarlyArticle` structured data for search engines (Google, Bing).

## Implementation Details

### Data Models (`src/**/models/*.ts`)

*   **Manuscript**: Represents the pre-publication work. Contains review data, submission files, and workflow status.
*   **Article**: Represents the published record.
    *   **Key Fields**: `manuscriptId` (link to origin), `volume`, `issue`, `doi`, `indexingStatus`, `views`, `downloads`.
    *   **ArticleType Enum**: `RESEARCH`, `REVIEW`, `CASE_STUDY`, `BOOK_REVIEW`, `EDITORIAL`, `COMMENTARY`.
*   **Volume**: Represents a yearly collection (e.g., Vol 1, 2024).
*   **Issue**: Represents a specific release within a volume (e.g., Issue 2).

### Key Controllers

1.  **`DecisionsController`** (`src/Review_System/controllers/finalDecisions.controller.ts`)
    *   **Critical Logic**: When `updateManuscriptStatus` sets status to `APPROVED`, it executes `new Article({...})`. This is the bridge from Review to Publication.

2.  **`PublicationController`** (`src/Publication/controllers/publication.controller.ts`)
    *   `getManuscriptsForPublication`: Lists articles created from manuscripts that are not yet published.
    *   `publishArticle`: Finalizes an article (assigns Vol/Issue, DOI) and sets `isPublished = true`.
    *   `createAndPublishManualArticle`: The "Bypass" route. Creates an Article directly with `isPublished = true`.

### Background Jobs
*   **Agenda**: Used to handle heavy lifting asynchronously.
*   **Job**: `publish-article`
*   **Triggers**:
    1.  DOI Registration.
    2.  Internet Archive Upload.
    3.  (Potentially) Sending notifications to subscribers.

## Summary of Files to Reference
*   **Models**: `src/Articles/model/article.model.ts`, `src/Manuscript_Submission/models/manuscript.model.ts`
*   **Services**: `src/Publication/services/*.ts`
*   **Controllers**: `src/Publication/controllers/publication.controller.ts`, `src/Review_System/controllers/finalDecisions.controller.ts`

---

## Codebase Audit: Risks & Incomplete Implementations

### 1. Race Conditions
*   **Duplicate Article Creation**: In `DecisionsController.updateManuscriptStatus`, there is no database transaction or optimistic locking. If two admins approve the same manuscript simultaneously, the system will verify status, then both will create a `new Article`, resulting in duplicate articles for a single manuscript.
*   **DOI Sequence Collision**: `CrossrefService` generates the DOI sequence using `Math.floor(Math.random() * 10000)`. This is non-deterministic and carries a collision risk, potentially leading to DOI registration failures or overwrites.
*   **Concurrent Publication**: `PublicationController.publishArticle` checks `if (article.isPublished)` before proceeding. Without atomic updates (`findOneAndUpdate` with condition), concurrent requests could trigger the publication workflow (and DOI registration) twice.

### 2. Incomplete / Redundant Implementations
*   **Metadata Generation Job (`generate-indexing-metadata`)**: This Agenda job generates XML/HTML metadata strings but **discards them immediately**, only updating boolean flags (`googleScholar=true`). Since the actual metadata is generated dynamically on-request (e.g., in `citation.controller.ts`), this background job is effectively redundant or missing a caching layer it was intended to populate.
*   **Filesystem Dependency**: Background jobs receive a local `pdfPath`. This assumes the Worker process shares the same filesystem as the API server. In containerized environments (Docker/Kubernetes) or separate instances, the Worker will fail to find the file unless a shared volume is explicitly configured. (This can be overlooked for now, I'll find a solution myself later or you could just drop a solution but not the implementation since its for later.)

### 3. Notification System Flaws
*   **Lack of Idempotency**: The `send-publication-notification` job iterates through *all* subscribers and sends emails. If the job fails (e.g., after 50 emails) and retries, it starts from the beginning, causing duplicate emails to the first 50 users.
*   **Missing "Sent" Tracking**: The system tracks `lastEmailSent` on the subscriber but does not track *which* article was sent. There is no `NotificationLog` ensuring a user receives exactly one email per article.

### 4. Edge Cases
*   **Admin Override**: The `OverrideDecisionController` updates the manuscript status string but **does not** trigger the side effects (like creating an `Article`). If an admin overrides a manuscript to `APPROVED`, it will effectively be "stuck" because no Article record exists for the Publication system to pick up.