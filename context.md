4.2 Manual Journal Upload
⏳ Manual Upload Controller (src/controllers/manualUpload.controller.ts)
Status: PLANNED
Purpose: Add archival journals or bypass submission process
Endpoint:
POST /api/v1/admin/journals/manual-upload
Body (multipart/form-data): {
title: string,
abstract: string,
keywords: string[],
pdfFile: File,
authors: [{ name, email, affiliation }],
faculty: string,
department: string,
publishDate: Date (optional, custom or current),
volume: number,
issue: number,
pages: { start, end },
doi: string (optional, if already assigned)
}
Process:

Admin uploads all journal metadata + PDF
System creates Journal document with status: 'published'
Assigns DOI if not provided
Indexes for search
Immediately available on public site
No review process required

Use Cases:

Importing historical journal archives
Migrating from old system
Emergency publications
Invited submissions from established authors

4.3 Publication Management
⏳ Publication Controller (src/controllers/publication.controller.ts)
Status: PLANNED
Publish Approved Journal:
POST /api/v1/admin/journals/:id/publish
Body: {
volume: number,
issue: number,
pages: { start: number, end: number },
publishDate: Date (optional, defaults to now)
}
Publication Flow:

Verify journal status: approved
Assign DOI (via Crossref integration)
Update Journal document:

status: 'published'
publishDate: specified or current
volume, issue, pages
doi

Generate citation metadata
Index for public search
Send publication notification to author
Make available on public site

Phase 5: Public Interface & Views 📋
5.1 Public Journal Display
⏳ Public Controller (src/controllers/public.controller.ts)
Status: PLANNED - Adapt view logic from articles context
Public Endpoints:

GET /api/v1/public/journals - List published journals
GET /api/v1/public/journal/:id - Single journal view
GET /api/v1/public/archives - Browse archives
GET /api/v1/public/popular - Most viewed journals
POST /api/v1/public/journal/:id/view - Record view
GET /api/v1/public/search - Search journals

Journal List Response:
typescript{
journals: [{
id: string,
title: string,
abstract: string (first 300 chars),
authors: [{ name, affiliation }],
publishDate: Date,
volume: number,
issue: number,
doi: string,
views: number,
pdfUrl: string,
}],
pagination: {
page: number,
totalPages: number,
totalCount: number
}
}

5.2 View Tracking
✅ View Logic (from Articles Context)
Status: READY TO ADAPT
Source: src/Articles/controllers/articleView.controller.js
View Recording Logic:
POST /api/v1/public/journal/:id/view

1. Get visitor identifier (IP address)
2. Check if viewed in last 24 hours
3. If not, increment view count
4. Add viewer to viewers array
5. Limit viewers array to last 1000 entries
6. Return updated view count
   Popular Journals:
   GET /api/v1/public/popular?limit=10&period=month

7. Query published journals
8. Filter by period (day/week/month/year/all)
9. Sort by views.count descending
10. Limit results
11. Return with author info
    View Statistics (Admin/Author):
    GET /api/v1/admin/journal/:id/views

12. Calculate daily view counts (last 30 days)
13. Group by date
14. Return time-series data for charts

5.3 Citation & Metadata
⏳ Citation Controller (src/controllers/citation.controller.ts)
Status: PLANNED
Citation Formats:
GET /api/v1/public/journal/:id/cite?format=bibtex

Supported formats:

- bibtex
- apa
- mla
- chicago
- harvard
- ris (for reference managers)
  Metadata Endpoint:
  GET /api/v1/public/journal/:id/metadata

Returns JSON-LD structured data for:

- Google Scholar indexing
- Citation crawlers
- Search engines
  Example Metadata:
  json{
  "@context": "https://schema.org",
  "@type": "ScholarlyArticle",
  "headline": "Journal Title",
  "abstract": "Abstract text...",
  "author": [{
  "@type": "Person",
  "name": "Author Name",
  "affiliation": "University"
  }],
  "datePublished": "2025-10-09",
  "doi": "10.1234/uniben.jh.2025.001",
  "publisher": {
  "@type": "Organization",
  "name": "University of Benin"
  },
  "license": "https://creativecommons.org/licenses/by/4.0/"
  }

Phase 6: DOI Integration 📋
6.1 Crossref Integration
⏳ DOI Service (src/services/doi.service.ts)
Status: PLANNED
Overview:
Crossref provides infrastructure for registering Digital Object Identifiers (DOIs) which create permanent links to published content, making journals easy to find, cite, link, and assess.
Requirements:

UNIBEN must register as Crossref member
Obtain Crossref credentials (username, password, prefix)
Use Crossref REST API for DOI registration
Deposit metadata for each published journal

DOI Format: 10.[PREFIX]/uniben.jh.2025.001 10.[PREFIX]/uniben.jst.2025.001

Where:

- [PREFIX] = Assigned by Crossref to UNIBEN
- jh = Journal of Humanities
- 2025 = Year
- 001 = Sequential number
  Registration Process:
  typescriptasync function registerDOI(journalId: string): Promise<string> {
  // 1. Generate DOI string
  const doi = generateDOI(journal);
  // 2. Prepare Crossref metadata XML
  const metadata = buildCrossrefMetadata(journal);
  // 3. Submit to Crossref API
  const response = await crossrefAPI.deposit(metadata);
  // 4. Update journal with DOI
  await Journal.findByIdAndUpdate(journalId, { doi });
  return doi;
  }
  Metadata Fields (Crossref):

Journal title
Article title
Authors (names, ORCIDs, affiliations)
Publication date
Volume, issue, pages
Abstract
PDF URL
License (CC BY 4.0)
Publisher info

Note: Initial implementation will use placeholder DOI strings. Full Crossref integration requires institutional setup.

6.2 ORCID Integration
⏳ ORCID Service (src/services/orcid.service.ts)
Status: FUTURE ENHANCEMENT
Purpose: Link authors to their ORCID identifiers for better attribution
Features:

Author ORCID input during submission
ORCID validation
Include in Crossref metadata
Display on public journal pages

Phase 8: Search & Filtering 📋
8.1 Full-Text Search
⏳ Search Controller (src/controllers/search.controller.ts)
Status: PLANNED
Search Endpoint:
GET /api/v1/public/search?q=climate&year=2025

Query Parameters:

- q: Search query (title, abstract, keywords)
- year: Publication year filter
- author: Author name filter
- faculty: Faculty filter
- department: Department filter
- page: Pagination
- limit: Results per page
- sort: 'relevance' | 'date' | 'views'
  Search Implementation:
  typescript// MongoDB text search
  const query = {
  status: 'published',
  $text: { $search: searchQuery }
  };

// Additional filters
if (type !== 'all') query.journalType = type;
if (year) query.publishDate = { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) };

// Sort by relevance score
const results = await Journal.find(query)
.select('title abstract authors publishDate doi views')
.sort({ score: { $meta: 'textScore' } })
.limit(limit);

8.2 Advanced Filters
⏳ Filter Logic
Status: PLANNED
Filter Panel:

Publication Year (range)
Faculty
Department
Author
Volume
Issue
Citation Count (future)

Phase 9: Archive Management 📋
9.1 Archive Organization
⏳ Archive Controller (src/controllers/archive.controller.ts)
Status: PLANNED
Archive Structure:
/api/v1/public/archives

Returns journals organized by:

- Volume
  - Issue - Journals[]
    Example Response:
    json{
    "volumes": [
    {
    "volume": 1,
    "year": 2025,
    "issues": [
    {
    "issue": 1,
    "publishDate": "2025-03-01",
    "journalCount": 8,
    "journals": [...]
    }
    ]
    }
    ]
    }
    Phase 10: Analytics & Reporting 📋
    10.1 System Analytics
    ⏳ Analytics Controller (src/controllers/analytics.controller.ts)
    Status: PLANNED
    Admin Analytics Dashboard:
    typescript{
    overview: {
    totalJournals: number,
    published: number,
    underReview: number,
    submitted: number,
    rejected: number
    },
    viewMetrics: {
    totalViews: number,
    viewsThisMonth: number,
    topViewedJournals: Journal[]
    },
    reviewMetrics: {
    averageReviewTime: number, // in days
    overdueReviews: number,
    completionRate: number
    },
    submissionTrends: {
    byMonth: [{ month: string, count: number }],
    byFaculty: [{ faculty: string, count: number }],
    }
    }
    Reviewer Analytics:
    typescript{
    reviewerId: string,
    name: string,
    statistics: {
    totalAssigned: number,
    completed: number,
    pending: number,
    overdue: number,
    completionRate: number,
    averageReviewTime: number,
    averageScore: number
    },
    recentReviews: Review[]
    }

DOI Assignment: Integration with Crossref for permanent identifiers
Citation Support: Generate citations in multiple formats
Public Discovery: Searchable archive accessible to everyone
Compliance Requirements
The system meets industry standards for academic publishing:

✅ Creative Commons CC BY 4.0 licensing
✅ COPE (Committee on Publication Ethics) guidelines
✅ Double-anonymous peer review
✅ Crossref DOI registration
✅ Google Scholar indexing preparation
✅ PKP Preservation Network compatibility
✅ DOAJ (Directory of Open Access Journals) eligibility

DOI assigned only when published
Custom publish dates for archives

Public- Browse published journals<br>- Search archives<br>- Download PDFs<br>- Generate citations

Publication Management
Publication Workflow
Journal Approved
│
├─→ Admin reviews journal
│
├─→ Admin clicks "Publish"
│ └─→ Opens publication form
│
├─→ Admin enters publication details:
│ ├─→ Volume number
│ ├─→ Issue number
│ ├─→ Page range (start-end)
│ └─→ Publish date (optional, defaults to now)
│
├─→ System processes:
│ ├─→ Assign DOI
│ ├─→ Update journal status: published
│ ├─→ Generate citation metadata
│ └─→ Index for search
│
└─→ Journal appears on public site
Publication Endpoint
typescriptPOST /api/v1/admin/journals/:id/publish
Authorization: Bearer {admin-token}

Body: {
volume: number;
issue: number;
pages: {
start: number;
end: number;
};
publishDate?: Date; // Optional, defaults to now
}

Response: {
success: true,
data: {
journalId: string;
doi: string;
publicUrl: string;
citationMetadata: object;
}
}
DOI Assignment
typescriptasync function assignDOI(journal: IJournal): Promise<string> {
// Generate DOI format: 10.PREFIX/uniben.{year}.{sequence}
const year = new Date(journal.publishDate).getFullYear();

// Get next sequence number for this year
const count = await Journal.countDocuments({
journalType: journal.journalType,
publishDate: {
$gte: new Date(year, 0, 1),
$lt: new Date(year + 1, 0, 1)
},
status: 'published'
});

const sequence = String(count + 1).padStart(3, '0');
const doi = `10.${process.env.CROSSREF_PREFIX}/uniben.${type}.${year}.${sequence}`;

// TODO: Register with Crossref
// await registerWithCrossref(journal, doi);

return doi;
}
Manual Journal Upload
Admin can bypass submission and add journals directly:
typescriptPOST /api/v1/admin/journals/manual-upload
Content-Type: multipart/form-data

{
title: string;
abstract: string;
keywords: string[];
pdfFile: File;
authors: [{name, email, affiliation, orcid}];
faculty: string;
department: string;
volume: number;
issue: number;
pages: {start, end};
publishDate: Date; // Custom date for archives
doi?: string; // If already assigned
}
Use Cases:

Importing historical archives
Migrating from old system
Invited/commissioned articles
Special issues

Public Interface
Public Endpoints
All published journals are accessible without authentication.

1. List Published Journals
   typescriptGET /api/v1/public/journals?&page=1&limit=20

Query Parameters:

- page: number (default 1)
- limit: number (default 20)
- sort: 'date' | 'views' | 'title' (default 'date')
- order: 'asc' | 'desc' (default 'desc')

Response: {
success: true,
data: {
journals: [{
id: string;
title: string;
abstract: string; // First 300 chars
authors: [{name, affiliation}];
publishDate: Date;
volume: number;
issue: number;
doi: string;
views: number;
pdfUrl: string;
}],
pagination: {
page: number;
totalPages: number;
totalCount: number;
}
}
} 2. Single Journal View
typescriptGET /api/v1/public/journal/:id

Response: {
success: true,
data: {
// Full journal details
title: string;
abstract: string;
keywords: string[];
authors: [{
name: string;
email: string;
affiliation: string;
orcid: string;
}];
publishDate: Date;
volume: number;
issue: number;
pages: {start, end};
doi: string;
pdfUrl: string;
views: number;
license: string;
citationMetadata: object;
}
} 3. Browse Archives
typescriptGET /api/v1/public/archives

Response: {
success: true,
data: {
journalType: string;
volumes: [{
volume: number;
year: number;
issues: [{
issue: number;
publishDate: Date;
journalCount: number;
journals: [...]
}]
}]
}
} 4. Search Journals
typescriptGET /api/v1/public/search?q=climate+change&type=all

Query Parameters:

- q: string (search query)
- year: number (filter by year)
- author: string (filter by author name)
- page: number
- limit: number

Response: {
success: true,
data: {
results: [...],
facets: {
years: [{year, count}],
types: [{type, count}],
authors: [{author, count}]
},
pagination: {...}
}
} 5. Record View
typescriptPOST /api/v1/public/journal/:id/view

// No body required
// Uses IP address as identifier

Response: {
success: true,
views: number
}
View Tracking Logic:

Identify visitor by IP address
Check if viewed in last 24 hours
If not, increment view count
Store viewer record with timestamp
Return updated view count

6. Get Popular Journals
   typescriptGET /api/v1/public/popular?limit=10&period=month

Query Parameters:

- limit: number (default 5)
- period: 'day' | 'week' | 'month' | 'year' | 'all'

Response: {
success: true,
data: [{
journal: {...},
views: number,
rank: number
}]
} 7. Generate Citation
typescriptGET /api/v1/public/journal/:id/cite?format=bibtex

Query Parameters:

- format: 'bibtex' | 'apa' | 'mla' | 'chicago' | 'harvard' | 'ris'

Response: {
success: true,
citation: string
}

// Example BibTeX
@article{uniben_jh_2025_001,
title={Climate Change Impact on Niger Delta},
author={Okonkwo, John and Smith, Jane},
journal={UNIBEN Journal of Humanities},
volume={1},
number={1},
pages={1--15},
year={2025},
publisher={University of Benin},
doi={10.12345/uniben.jh.2025.001}
} 8. Get Metadata
typescriptGET /api/v1/public/journal/:id/metadata

Response: {
success: true,
metadata: {
// JSON-LD format for search engines
"@context": "https://schema.org",
"@type": "ScholarlyArticle",
...
}
}

- volume: positive integer, required
- issue: positive integer, required
- pages.start: positive integer, required
- pages.end: must be >= pages.start, required
- publishDate: valid date, optional

2. Crossref API (Future)
   DOI Registration:
   typescriptinterface CrossrefMetadata {
   title: string;
   authors: Array<{
   given: string;
   family: string;
   affiliation: string;
   orcid?: string;
   }>;
   publicationDate: string;
   journal: {
   title: string;
   issn: string;
   };
   doi: string;
   pages: {
   first: string;
   last: string;
   };
   abstract: string;
   license: {
   url: string;
   start: string;
   };
   resource: string; // PDF URL
   }

async function registerDOIWithCrossref(journal: IJournal, doi: string) {
const metadata = buildCrossrefMetadata(journal, doi);

const response = await axios.post(
'https://doi.crossref.org/servlet/deposit',
metadata,
{
auth: {
username: process.env.CROSSREF_USERNAME,
password: process.env.CROSSREF_PASSWORD
},
headers: {
'Content-Type': 'application/vnd.crossref.deposit+xml'
}
}
);

return response.data;
}

4.  Citation Generator Service
    typescriptclass CitationService {
    generateBibTeX(journal: IJournal): string {
    const year = new Date(journal.publishDate).getFullYear();
    const authors = journal.contributors
    .map(c => c.name.split(' ').pop())
    .join(' and ');
    return `@article{${journal.doi.replace(/\W/g, '_')},
  title={${journal.title}},
author={${authors}},
  journal={UNIBEN Journal of ${journal.journalType === 'humanities' ? 'Humanities' : 'Science & Technology'}},
volume={${journal.volume}},
  number={${journal.issue}},
pages={${journal.pages.start}--${journal.pages.end}},
year={${year}},
  publisher={University of Benin},
  doi={${journal.doi}}
  }`;
    }

generateAPA(journal: IJournal): string {
const year = new Date(journal.publishDate).getFullYear();
const authors = this.formatAuthorsAPA(journal.contributors);

    return `${authors} (${year}). ${journal.title}. UNIBEN Journal of ${journal.journalType === 'humanities' ? 'Humanities' : 'Science & Technology'}, ${journal.volume}(${journal.issue}), ${journal.pages.start}–${journal.pages.end}. https://doi.org/${journal.doi}`;

}

// Additional citation formats...
}

// Use Agenda for CPU-intensive tasks
agenda.define('generate DOI/ indexing', async (job) => {
const { journalId } = job.attrs.data;
// This runs in a separate process/worker
await generateDOIandIndexing(journalId);
});

// Schedule job instead of blocking request
await agenda.now('generate DOI/ indexing', { journalId });

1. Controller Pattern
   typescriptimport asyncHandler from '../utils/asyncHandler';
   import { NotFoundError, BadRequestError } from '../utils/customErrors';
   import logger from '../utils/logger';

class ExampleController {
methodName = asyncHandler(async (req, res) => {
// Business logic
const result = await Model.find();

    logger.info(`Action completed: ${result.id}`);

    res.status(200).json({
      success: true,
      data: result
    });

});
}

export default new ExampleController();

// In controller
throw new BadRequestError('Invalid email format');
throw new NotFoundError('Journal not found');
throw new UnauthorizedError('Invalid credentials');

// asyncHandler catches and passes to errorHandler middleware

Common Adaptations Needed
From Journals → Articles:

Replace Journals with Articles
Replace journals with Articles
