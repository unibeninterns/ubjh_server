import { IArticle } from '../../Articles/model/article.model';
import logger from '../../utils/logger';

interface Author {
  name: string;
  affiliation?: string;
  email?: string;
}

class IndexingService {
  /**
   * Generate Google Scholar meta tags for HTML
   */
  generateGoogleScholarMetaTags(
    article: IArticle,
    authors: Author[],
    volume: any,
    issue: any
  ): string {
    const tags: string[] = [];

    // Citation metadata
    tags.push(
      `<meta name="citation_title" content="${this.escapeHtml(article.title)}">`
    );

    authors.forEach((author) => {
      tags.push(
        `<meta name="citation_author" content="${this.escapeHtml(author.name)}">`
      );
      if (author.affiliation) {
        tags.push(
          `<meta name="citation_author_institution" content="${this.escapeHtml(author.affiliation)}">`
        );
      }
    });

    tags.push(
      '<meta name="citation_journal_title" content="UNIBEN Journal of Humanities">'
    );
    tags.push(`<meta name="citation_volume" content="${volume.volumeNumber}">`);
    tags.push(`<meta name="citation_issue" content="${issue.issueNumber}">`);

    if (article.pages) {
      tags.push(
        `<meta name="citation_firstpage" content="${article.pages.start}">`
      );
      tags.push(
        `<meta name="citation_lastpage" content="${article.pages.end}">`
      );
    }

    tags.push(
      `<meta name="citation_publication_date" content="${article.publishDate.toISOString().split('T')[0]}">`
    );

    if (article.doi) {
      tags.push(`<meta name="citation_doi" content="${article.doi}">`);
    }

    tags.push(
      `<meta name="citation_pdf_url" content="${process.env.FRONTEND_URL}/articles/${article._id}/pdf">`
    );
    tags.push(
      `<meta name="citation_abstract_html_url" content="${process.env.FRONTEND_URL}/articles/${article._id}">`
    );

    // Open Graph tags
    tags.push(
      `<meta property="og:title" content="${this.escapeHtml(article.title)}">`
    );
    tags.push(
      `<meta property="og:description" content="${this.escapeHtml(article.abstract.substring(0, 200))}...">`
    );
    tags.push('<meta property="og:type" content="article">');
    tags.push(
      `<meta property="og:url" content="${process.env.FRONTEND_URL}/articles/${article._id}">`
    );

    logger.info(
      `Generated Google Scholar meta tags for article ${article._id}`
    );
    return tags.join('\n');
  }

  /**
   * Generate OAI-PMH metadata record for BASE/CORE harvesting
   */
  generateOAIPMHRecord(
    article: IArticle,
    authors: Author[],
    volume: any,
    issue: any
  ): string {
    const identifier = `oai:uniben.edu:article/${article._id}`;
    const datestamp = article.publishDate.toISOString().split('T')[0];

    const authorsXML = authors
      .map(
        (author) =>
          `    <dc:creator>${this.escapeHtml(author.name)}</dc:creator>`
      )
      .join('\n');

    const keywordsXML = article.keywords
      .map(
        (keyword) => `    <dc:subject>${this.escapeHtml(keyword)}</dc:subject>`
      )
      .join('\n');

    const doiXML = article.doi ? `    <dc:identifier>https://doi.org/${article.doi}</dc:identifier>` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<record>
  <header>
    <identifier>${identifier}</identifier>
    <datestamp>${datestamp}</datestamp>
    <setSpec>article</setSpec>
  </header>
  <metadata>
    <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
               xmlns:dc="http://purl.org/dc/elements/1.1/"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
    <dc:title>${this.escapeHtml(article.title)}</dc:title>
${authorsXML}
    <dc:description>${this.escapeHtml(article.abstract)}</dc:description>
${keywordsXML}
    <dc:publisher>University of Benin</dc:publisher>
    <dc:date>${datestamp}</dc:date>
    <dc:type>article</dc:type>
    <dc:format>application/pdf</dc:format>
${doiXML}
    <dc:identifier>${process.env.FRONTEND_URL}/articles/${article._id}</dc:identifier>
    <dc:language>en</dc:language>
    <dc:rights>CC BY 4.0</dc:rights>
    <dc:source>UNIBEN Journal of Humanities, Vol. ${volume.volumeNumber}, No. ${issue.issueNumber}</dc:source>
    </oai_dc:dc>
  </metadata>
</record>`;
  }

  /**
   * Generate JSON-LD structured data for SEO
   */
  generateJSONLD(
    article: IArticle,
    authors: Author[],
    volume: any,
    issue: any
  ): string {
    const authorsJSON = authors.map((author) => ({
      '@type': 'Person',
      name: author.name,
      affiliation: author.affiliation || 'University of Benin',
    }));

    const data = {
      '@context': 'https://schema.org',
      '@type': 'ScholarlyArticle',
      headline: article.title,
      abstract: article.abstract,
      author: authorsJSON,
      datePublished: article.publishDate.toISOString().split('T')[0],
      publisher: {
        '@type': 'Organization',
        name: 'University of Benin',
      },
      isPartOf: {
        '@type': 'PublicationIssue',
        issueNumber: issue.issueNumber.toString(),
        isPartOf: {
          '@type': 'PublicationVolume',
          volumeNumber: volume.volumeNumber.toString(),
          isPartOf: {
            '@type': 'Periodical',
            name: 'UNIBEN Journal of Humanities',
            issn: process.env.JOURNAL_ISSN || '',
          },
        },
      },
      keywords: article.keywords.join(', '),
      license: 'https://creativecommons.org/licenses/by/4.0/',
    };

    if (article.doi) {
      (data as any).identifier = `https://doi.org/${article.doi}`;
    }

    if (article.pages) {
      (data as any).pagination = `${article.pages.start}-${article.pages.end}`;
    }

    logger.info(`Generated JSON-LD for article ${article._id}`);
    return JSON.stringify(data, null, 2);
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

export default new IndexingService();
