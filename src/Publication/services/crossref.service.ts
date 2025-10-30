import axios from 'axios';
import logger from '../../utils/logger';
import { IArticle } from '../../Articles/model/article.model';

interface CrossrefMetadata {
  doi_batch_id: string;
  timestamp: number;
  depositor: {
    depositor_name: string;
    email_address: string;
  };
  registrant: string;
  journal: {
    journal_metadata: {
      full_title: string;
      abbrev_title?: string;
      issn: string;
    };
    journal_issue: {
      publication_date: {
        year: number;
        month: number;
        day: number;
      };
      journal_volume: {
        volume: string;
      };
      issue: string;
    };
  };
  journal_article: {
    titles: {
      title: string;
    };
    contributors: Array<{
      given_name: string;
      surname: string;
      sequence: 'first' | 'additional';
      ORCID?: string;
      affiliation?: string;
    }>;
    publication_date: {
      year: number;
      month: number;
      day: number;
    };
    pages?: {
      first_page: string;
      last_page: string;
    };
    doi_data: {
      doi: string;
      resource: string;
    };
    abstract?: string;
  };
}

class CrossrefService {
  private baseUrl: string;
  private username: string;
  private password: string;
  private doiPrefix: string;
  private depositorName: string;
  private depositorEmail: string;

  constructor() {
    this.baseUrl = 'https://doi.crossref.org/servlet/deposit';
    this.username = process.env.CROSSREF_USERNAME || '';
    this.password = process.env.CROSSREF_PASSWORD || '';
    this.doiPrefix = process.env.CROSSREF_DOI_PREFIX || '';
    this.depositorName =
      process.env.CROSSREF_DEPOSITOR_NAME || 'UNIBEN Journal of Humanities';
    this.depositorEmail = process.env.CROSSREF_DEPOSITOR_EMAIL || '';

    if (!this.username || !this.password || !this.doiPrefix) {
      logger.warn('Crossref credentials not fully configured');
    }
  }

  /**
   * Generate DOI for article
   */
  generateDOI(article: IArticle, volume: any, issue: any): string {
    const year = new Date(article.publishDate).getFullYear();
    const sequenceNumber = String(Math.floor(Math.random() * 10000)).padStart(
      4,
      '0'
    );
    return `${this.doiPrefix}/ubjh.${year}.${volume.volumeNumber}.${issue.issueNumber}.${sequenceNumber}`;
  }

  /**
   * Build Crossref XML metadata
   */
  private buildCrossrefXML(
    article: IArticle,
    authors: any[],
    volume: any,
    issue: any,
    doi: string
  ): string {
    const pubDate = new Date(article.publishDate);
    const batchId = `ubjh_${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    // Parse author names
    const contributors = authors
      .map((author, index) => {
        const nameParts = author.name.trim().split(' ');
        const surname = nameParts[nameParts.length - 1];
        const givenName = nameParts.slice(0, -1).join(' ');

        return `
        <person_name sequence="${index === 0 ? 'first' : 'additional'}" contributor_role="author">
          <given_name>${this.escapeXml(givenName)}</given_name>
          <surname>${this.escapeXml(surname)}</surname>
          ${author.orcid ? `<ORCID>https://orcid.org/${author.orcid}</ORCID>` : ''}
          ${author.affiliation ? `<affiliation>${this.escapeXml(author.affiliation)}</affiliation>` : ''}
        </person_name>`;
      })
      .join('\n');

    const pages = article.pages
      ? `<pages>
          <first_page>${article.pages.start}</first_page>
          <last_page>${article.pages.end}</last_page>
        </pages>`
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<doi_batch xmlns="http://www.crossref.org/schema/5.3.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           version="5.3.1"
           xsi:schemaLocation="http://www.crossref.org/schema/5.3.1 http://www.crossref.org/schemas/crossref5.3.1.xsd">
  <head>
    <doi_batch_id>${batchId}</doi_batch_id>
    <timestamp>${timestamp}</timestamp>
    <depositor>
      <depositor_name>${this.escapeXml(this.depositorName)}</depositor_name>
      <email_address>${this.depositorEmail}</email_address>
    </depositor>
    <registrant>University of Benin</registrant>
  </head>
  <body>
    <journal>
      <journal_metadata>
        <full_title>UNIBEN Journal of Humanities</full_title>
        <abbrev_title>UBJH</abbrev_title>
        <issn media_type="electronic">${process.env.JOURNAL_ISSN || ''}</issn>
      </journal_metadata>
      <journal_issue>
        <publication_date>
          <year>${pubDate.getFullYear()}</year>
          <month>${pubDate.getMonth() + 1}</month>
          <day>${pubDate.getDate()}</day>
        </publication_date>
        <journal_volume>
          <volume>${volume.volumeNumber}</volume>
        </journal_volume>
        <issue>${issue.issueNumber}</issue>
      </journal_issue>
      <journal_article publication_type="full_text">
        <titles>
          <title>${this.escapeXml(article.title)}</title>
        </titles>
        <contributors>
          ${contributors}
        </contributors>
        <publication_date>
          <year>${pubDate.getFullYear()}</year>
          <month>${pubDate.getMonth() + 1}</month>
          <day>${pubDate.getDate()}</day>
        </publication_date>
        ${pages}
        <doi_data>
          <doi>${doi}</doi>
          <resource>${process.env.FRONTEND_URL}/articles/${article._id}</resource>
        </doi_data>
        <abstract xmlns="http://www.ncbi.nlm.nih.gov/JATS1">
          <p>${this.escapeXml(article.abstract)}</p>
        </abstract>
      </journal_article>
    </journal>
  </body>
</doi_batch>`;
  }

  /**
   * Register DOI with Crossref
   */
  async registerDOI(
    article: IArticle,
    authors: any[],
    volume: any,
    issue: any
  ): Promise<{ doi: string; batchId: string }> {
    try {
      // Generate DOI
      const doi = this.generateDOI(article, volume, issue);

      // Build XML
      const xml = this.buildCrossrefXML(article, authors, volume, issue, doi);

      // Submit to Crossref
      const response = await axios.post(this.baseUrl, xml, {
        params: {
          operation: 'doMDUpload',
          login_id: this.username,
          login_passwd: this.password,
        },
        headers: {
          'Content-Type': 'application/vnd.crossref.deposit+xml',
        },
      });

      logger.info(`Crossref DOI registered: ${doi}`);

      // Extract batch ID from response
      const batchIdMatch = response.data.match(/batch_id="([^"]+)"/);
      const batchId = batchIdMatch ? batchIdMatch[1] : `ubjh_${Date.now()}`;

      return { doi, batchId };
    } catch (error: any) {
      logger.error('Crossref DOI registration failed:', error.message);
      throw new Error(`Crossref registration failed: ${error.message}`);
    }
  }

  /**
   * Check DOI registration status
   */
  async checkDOIStatus(doi: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://api.crossref.org/works/${doi}`,
        {
          headers: {
            'User-Agent':
              'UNIBEN-Journal-Humanities/1.0 (mailto:' +
              this.depositorEmail +
              ')',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Failed to check DOI status:', error.message);
      return null;
    }
  }

  private escapeXml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

export default new CrossrefService();
