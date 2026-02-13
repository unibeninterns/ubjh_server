# Author System and Dashboard Context Report

This document provides a detailed overview of the author-related components in the UBJH (University of Benin Journal of Humanities) server. It covers the data models, APIs, and workflows relevant to users with the `author` role, intended to support the development of an Author Dashboard.

---

## 1. Author Role Overview
In the system, the `author` role is one of the three primary roles (`admin`, `author`, `reviewer`). Authors are primarily responsible for:
- Submitting new manuscripts.
- Tracking the progress of their submissions.
- Revising manuscripts based on reviewer and editor feedback.
- Managing co-author information.
- Viewing published articles and their analytics.

---

## 2. User Data for Authors
The `User` model (in `src/model/user.model.ts`) contains the following fields relevant to authors:

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | String | Full name of the author. |
| `email` | String | Primary email (used for login and notifications). |
| `role` | Enum | Set to `UserRole.AUTHOR`. |
| `faculty` | String | Faculty and Department (usually separated by a comma). |
| `affiliation` | String | Institution or organization. |
| `orcid` | String | ORCID ID (format: 0000-0000-0000-0000). |
| `phoneNumber` | String | Optional contact number. |
| `areaOfSpecialization`| String | Author's field of expertise. |
| `isActive` | Boolean | Whether the account is active (authors must be active to log in). |
| `manuscripts` | ObjectId[] | References to `Manuscript` documents where this user is the submitter. |
| `invitationStatus` | Enum | `pending`, `accepted`, `added`, `expired`, `none`. |
| `credentialsSent` | Boolean | Tracks if login credentials have been sent to the author. |

---

## 3. Manuscript Submission & Workflow
### Submission Process (`src/Manuscript_Submission/controllers/submitManuscript.controller.ts`)
Authors can submit manuscripts even before they have a full account. The system:
1.  **Finds or Creates User**: When a manuscript is submitted, the system checks if the submitter's email exists. If not, it creates a "pending" author account.
2.  **Handles Co-Authors**:
    - **Complete Co-Authors**: If full info is provided, they are created as users.
    - **Incomplete Co-Authors**: Stored in `IncompleteCoAuthor` model until details are updated.
3.  **Confirmation**: A confirmation email is sent, and login credentials follow (usually within 24h-7d).

### Manuscript Statuses
- `submitted`: Initial state.
- `under_review`: Assigned to reviewers.
- `in_reconciliation`: Discrepancy between reviewers found; editor or reconciler intervening.
- `approved`: Ready for publication.
- `rejected`: Submission declined.
- `minor_revision` / `major_revision`: Author needs to update the manuscript.
- `revised`: Author has submitted a revision.

---

## 4. Author Dashboard API (`src/authors/controllers/author.controller.ts`)
The `GET /api/author/dashboard` endpoint provides essential data for the dashboard:

### Data Returned:
- **Profile**: Full user profile (excluding sensitive fields).
- **Manuscripts**: List of all manuscripts where the user is the `submitter`.
    - Populates `submitter` and `incompleteCoAuthors`.
- **Stats**:
    - `totalManuscripts`: Count of all submissions.
    - `statusCounts`: Breakdown of manuscripts by each status (e.g., how many are `under_review`).
- **Recent Manuscript**: The most recently updated manuscript for quick access.

---

## 5. Manuscript Management
### Manuscript Details (`GET /api/author/manuscripts/:manuscriptId`)
- Returns full details of a specific manuscript.
- **Critical for Dashboard**: This includes `reviewComments.commentsForAuthor`, which contains the feedback the author needs to address during revisions.

### Revisions (`src/authors/controllers/reviseManuscript.controller.ts`)
- **Endpoint**: `POST /api/revise-manuscript/:id`
- **Permissions**: Only the `submitter` can revise, and only if status is `minor_revision` or `major_revision`.
- **Updated Fields**: `title`, `abstract`, `keywords`, and a new `revisedPdfFile`.
- **Status Change**: Reverts status to `submitted` for re-evaluation.

### Co-Author Management (`src/authors/controllers/coAuthor.controller.ts`)
- Authors can view and update information for co-authors.
- When an `IncompleteCoAuthor` is updated with all required fields (name, email, faculty, affiliation), they are converted into a full `User` record.

---

## 6. Review System Interaction
Authors **do not** interact directly with reviewers (double-blind process).
- Reviewers submit comments via `commentsForAuthor`.
- Admins/Editors finalize these comments in the `finalDecisions.controller.ts`.
- Authors view these finalized comments through the Manuscript Details API.

---

## 7. Published Articles & Analytics
Once a manuscript is `approved`, it is converted into an `Article` (in `src/Articles/model/article.model.ts`).
- **Analytics**: Each article tracks `views` (with unique visitor tracking per 24h), `downloads`, and `citationCount`.
- **Author Access**: While not explicitly in a dedicated "author-only" analytics route, the `ArticleAnalyticsController` provides:
    - `getArticleAnalytics`: Time-series data for views and downloads.
    - `getPopularArticles`: Ranking based on metrics.

---

## 8. Requirements for Author Dashboard UI
Based on the available data, the Author Dashboard should implement:

1.  **Statistics Overview Cards**:
    - Total Submissions.
    - Ongoing Reviews.
    - Published Articles (derived from `Article` model where `author` matches userId).
    - Pending Revisions.

2.  **Manuscript Table**:
    - List of submissions with Title, Date, and Status badges.
    - Actions: View Details, Revise (if status allows), Manage Co-authors.

3.  **Profile Management**:
    - View/Update ORCID, Affiliation, and Specialization.

4.  **Submission Wizard**:
    - Form to upload PDF and enter metadata (title, abstract, keywords).
    - Dynamic co-author addition (handles both existing users and new invitations).

5.  **Notifications/Inbox**:
    - Feedback from reviewers/editors.
    - Status change alerts.

6.  **Published Work Section**:
    - List of articles with DOI links and real-time view/download counts.

---

## 9. Implementation Prompt: Plagiarism-Based Archiving & Call for Papers

**Goal**: Implement a specialized archiving workflow based on plagiarism percentage, a "Call for Papers" toggle, and an author resubmission flow.

### 1. Model Updates
- **`src/Manuscript_Submission/models/manuscript.model.ts`**:
    - Add `plagiarismPercentage: Number`
    - Add `plagiarismReport: String` (URL path to uploaded DOCX/PDF)
    - Add `archiveType: Enum ('plagiarism_low', 'plagiarism_high', 'manual')`
    - Add `hasBeenResubmitted: Boolean` (Default: `false`)
- **New Model: `src/model/settings.model.ts`**:
    - Add `isCallForPapersActive: { type: Boolean, default: true }`
    - Only one document should exist in this collection.

### 2. "Call for Papers" Management
- **Admin Controller**: Create `getSystemSettings` and `updateSystemSettings` to toggle the flag.
- **Enforcement**:
    - **Submit Controller**: Block new submissions if `isCallForPapersActive` is `false`.
    - **Author Dashboard**: Include `isCallForPapersActive` in the response for frontend button disabling.

### 3. Admin Archive Controller (`src/Review_System/controllers/archiveManuscript.controller.ts`)
- Dedicated controller for all archiving logic.
- **Method: `archiveManuscript`**:
    - **Inputs**: `manuscriptId`, `percentage`, `reason`, `archiveType`, and `file` (plagiarism report).
    - **Logic**:
        - **Low Plagiarism (20-30%)**: Set `archiveType: 'plagiarism_low'`, upload report, send `lowPlagiarismNotification` email.
        - **High Plagiarism (>30%)**: Set `archiveType: 'plagiarism_high'`, save reason, send `highPlagiarismNotification` email.
- **Email Logic**: Only include credentials if `user.credentialsSent === false`.

### 4. Author Resubmission Flow (`src/authors/controllers/author.controller.ts`)
- **Method: `resubmitFromArchive`**:
    - Create a **NEW** manuscript document (new ID).
    - Clone all metadata (title, abstract, keywords, authors).
    - Set `revisedFrom` on the new manuscript.
    - Set `hasBeenResubmitted: true` on the original.

### 5. Dashboard UI Logic (Frontend)
- **Submit Button**: Disable if `isCallForPapersActive` is `false`.
- **Archived Entry**:
    - If `plagiarism_low` and `hasBeenResubmitted === false`:
        - **Display "Submit Revision" button**.
        - **Display "Download Plagiarism Report" link**.
    - If `plagiarism_high`:
        - Show **"Archived (High Plagiarism)"** and the `archiveReason`.
    - If `hasBeenResubmitted === true`:
        - Hide the "Submit Revision" button.

### 6. Email Templates
- **`lowPlagiarismNotification`**: Report link + "Submit Revision" instructions + Credentials (if first time).
- **`highPlagiarismNotification`**: Reason + "Wait for next Call" instructions + Credentials (if first time).

---

## 10. Context Files for Implementation

The following files are essential for understanding and implementing this workflow:

**Models**:
- `src/model/user.model.ts`
- `src/Manuscript_Submission/models/manuscript.model.ts`
- `src/Review_System/models/review.model.ts`
- `src/Articles/model/article.model.ts`

**Controllers**:
- `src/controllers/admin.controller.ts`
- `src/authors/controllers/author.controller.ts`
- `src/Manuscript_Submission/controllers/submitManuscript.controller.ts`
- `src/Review_System/controllers/assignReview.controller.ts` (Pattern reference)

**Routes**:
- `src/routes/admin.routes.ts`
- `src/authors/routes/author.routes.ts`
- `src/Manuscript_Submission/routes/submitManuscript.routes.ts`

**Services & Utils**:
- `src/services/email.service.ts`
- `src/services/user.service.ts`
- `src/utils/customErrors.ts`
- `src/middleware/auth.middleware.ts`

Raw prompts to be used as context only


-just handle it in the frontend for the author dashboard that if the status is reconciliation then it should still show under review in the frontend

-Then I want to be able to implement a workflow where the manuscript can be archived but then the archive is then going to be divided into two sections, the first section is going to be for the manuscript with 20-30%, archiving a manuscript under that section involves uploading the plagiarism report and then it sends the author a mail saying he can revise the manuscript and then he gets his login credentials and is able to login into his dashboard and then submit the revised manuscript, meaning in his dashboard, he'll see the manuscript in the manuscript section of the dashboard with the archive status and it'll have a submit revision button attached to it and then clicking on that and then uploading the revised manuscript will then create it as a new submission using all the previous info of the first manuscript, then going to the manuscript page will then show two manuscripts there, and then the first manuscript will then show the archived status without any submit revision button this time, then there's the second option in the archiving and that's for above 30% ,for those one they author get a message saying their manuscript have been archived then there would be the reason field and then the reason will be typed there and then clicking on archive sends the email which will also contain the credentials to login into the dashboard and also telling them to submit again during the next call for papers and then there would be a button to submit a manuscript which will be inactive till the the next call for paper.

-In all this I still want the implementation for the admin, it's going to be an option in the admin manuscripts page in the frontend, same way I did the assign reviewer option in that manuscript page using it's corresponding controller by the admin to be able to assign reviewer is the same way I want controllers like that for the admin to be able archive and then select the type of archive and the other inputs neccesary for the archive and all, I don't know if you understand but still ask clarifying questions for this too why I also answer your former clarifying questions above: 1. Yes 2. Yes 3. I don't have a global toggle but skip this for later not now 4. Yes a new manuscript entry with a way to track that it's a revision if that's not implemented already. 5. Yes it can skip sending the credentials if it has been sent before

-you know what I want to implement that call for papers toggle rn give details on how this project can do it, and the for the dashboard UI Logic and the settings management with the info for the two email templates that you removed, isn't that important? for your recent clarifying questions: 1. PDF/DOCX only no images 2. Yes 3. new ID. Then after all this at the bottom of the file, I want you to add all the files that needs to be given to a model as context, just list the models, controllers, routes,  services if any, utils, if any.

