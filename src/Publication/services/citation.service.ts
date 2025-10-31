import { IArticle } from '../../Articles/model/article.model';

interface Author {
  name: string;
  affiliation?: string;
}

class CitationService {
  /**
   * Format author names for different citation styles
   */
  private formatAuthorsAPA(authors: Author[]): string {
    if (authors.length === 0) return '';
    if (authors.length === 1) return this.formatAuthorNameAPA(authors[0].name);
    if (authors.length === 2) {
      return `${this.formatAuthorNameAPA(authors[0].name)} & ${this.formatAuthorNameAPA(authors[1].name)}`;
    }

    const firstAuthor = this.formatAuthorNameAPA(authors[0].name);
    return `${firstAuthor} et al.`;
  }

  private formatAuthorNameAPA(fullName: string): string {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];

    const lastName = parts[parts.length - 1];
    const initials = parts
      .slice(0, -1)
      .map((name) => `${name.charAt(0).toUpperCase()}.`)
      .join(' ');

    return `${lastName}, ${initials}`;
  }

  private formatAuthorsMLA(authors: Author[]): string {
    if (authors.length === 0) return '';
    if (authors.length === 1) return this.formatAuthorNameMLA(authors[0].name);
    if (authors.length === 2) {
      return `${this.formatAuthorNameMLA(authors[0].name)}, and ${authors[1].name}`;
    }

    return `${this.formatAuthorNameMLA(authors[0].name)}, et al.`;
  }

  private formatAuthorNameMLA(fullName: string): string {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];

    const lastName = parts[parts.length - 1];
    const firstName = parts.slice(0, -1).join(' ');

    return `${lastName}, ${firstName}`;
  }

  /**
   * Generate APA 7th edition citation
   */
  generateAPA(
    article: IArticle,
    authors: Author[],
    volume: any,
    issue: any
  ): string {
    const year = article.publishDate.getFullYear();
    const authorStr = this.formatAuthorsAPA(authors);
    const pages = article.pages ? `${article.pages.start}–${article.pages.end}` : '';

    let citation = `${authorStr} (${year}). ${article.title}. UNIBEN Journal of Humanities, ${volume.volumeNumber}(${issue.issueNumber})`;

    if (pages) {
      citation += `, ${pages}`;
    }

    if (article.doi) {
      citation += `. https://doi.org/${article.doi}`;
    }

    return citation;
  }

  /**
   * Generate MLA 9th edition citation
   */
  generateMLA(
    article: IArticle,
    authors: Author[],
    volume: any,
    issue: any
  ): string {
    const authorStr = this.formatAuthorsMLA(authors);
    const pages = article.pages ? `pp. ${article.pages.start}–${article.pages.end}` : '';

    let citation = `${authorStr}. "${article.title}." UNIBEN Journal of Humanities, vol. ${volume.volumeNumber}, no. ${issue.issueNumber}, ${article.publishDate.getFullYear()}`;

    if (pages) {
      citation += `, ${pages}`;
    }

    if (article.doi) {
      citation += `. doi:${article.doi}`;
    }

    citation += '.';

    return citation;
  }

  /**
   * Generate Chicago citation
   */
  generateChicago(
    article: IArticle,
    authors: Author[],
    volume: any,
    issue: any
  ): string {
    const authorStr = this.formatAuthorsAPA(authors);
    const pages = article.pages ? `${article.pages.start}–${article.pages.end}` : '';

    let citation = `${authorStr}. "${article.title}." UNIBEN Journal of Humanities ${volume.volumeNumber}, no. ${issue.issueNumber} (${article.publishDate.getFullYear()})`;

    if (pages) {
      citation += `: ${pages}`;
    }

    if (article.doi) {
      citation += `. https://doi.org/${article.doi}`;
    }

    citation += '.';

    return citation;
  }

  /**
   * Generate Harvard citation
   */
  generateHarvard(
    article: IArticle,
    authors: Author[],
    volume: any,
    issue: any
  ): string {
    const year = article.publishDate.getFullYear();
    const authorStr = this.formatAuthorsAPA(authors);
    const pages = article.pages ? `pp.${article.pages.start}–${article.pages.end}` : '';

    let citation = `${authorStr}, ${year}. ${article.title}. UNIBEN Journal of Humanities, ${volume.volumeNumber}(${issue.issueNumber})`;

    if (pages) {
      citation += `, ${pages}`;
    }

    citation += '.';

    return citation;
  }

  /**
   * Generate BibTeX citation
   */
  generateBibTeX(
    article: IArticle,
    authors: Author[],
    volume: any,
    issue: any
  ): string {
    const year = article.publishDate.getFullYear();
    const citationKey = `${authors[0]?.name.split(' ').pop()?.toLowerCase()}${year}`;

    const authorList = authors.map((a) => a.name).join(' and ');

    const pages = article.pages ? `  pages = {${article.pages.start}--${article.pages.end}},\n` : '';

    const doi = article.doi ? `  doi = {${article.doi}},\n` : '';

    return `@article{${citationKey},
  title = {${article.title}},
  author = {${authorList}},
  journal = {UNIBEN Journal of Humanities},
  volume = {${volume.volumeNumber}},
  number = {${issue.issueNumber}},
  year = {${year}},
${pages}${doi}  publisher = {University of Benin}
}`;
  }

  /**
   * Generate RIS citation (for reference managers)
   */
  generateRIS(
    article: IArticle,
    authors: Author[],
    volume: any,
    issue: any
  ): string {
    const year = article.publishDate.getFullYear();
    const pages = article.pages ? `SP  - ${article.pages.start}\nEP  - ${article.pages.end}\n` : '';

    const authorLines = authors.map((a) => `AU  - ${a.name}`).join('\n');
    const doi = article.doi ? `DO  - ${article.doi}\n` : '';

    return `TY  - JOUR
${authorLines}
TI  - ${article.title}
T2  - UNIBEN Journal of Humanities
VL  - ${volume.volumeNumber}
IS  - ${issue.issueNumber}
PY  - ${year}
${pages}${doi}PB  - University of Benin
ER  - `;
  }
}

export default new CitationService();
