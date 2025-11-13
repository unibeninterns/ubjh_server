import { commonStyles, commonFooter } from './styles';
import { ManuscriptStatus } from '../../Manuscript_Submission/models/manuscript.model';

export const manuscriptStatusUpdateTemplate = (
  name: string,
  manuscriptTitle: string,
  status: ManuscriptStatus,
  fundingAmount?: number,
  feedbackComments?: string
): string => {
  let subjectLine = '';
  let bodyContent = '';

  if (status === ManuscriptStatus.APPROVED) {
    subjectLine = 'Congratulations! Your Manuscript Has Been Approved';
    bodyContent = `
        <p>Dear ${name},</p>
        <p>We are pleased to inform you that your manuscript "<strong>${manuscriptTitle}</strong>" has been approved.</p>
    `;
    bodyContent += `
        <p>You manuscript will be processed for indexing and DOI integration and then published on the Uniben Journal for Humanities.</p>
        <p>Login into your author dashboard using the credentials sent previously to view the status of your manuscript.</p>
    `;
  } else if (status === ManuscriptStatus.REJECTED) {
    subjectLine = 'Update on Your Manuscript Submission: Decision Made';
    bodyContent = `
        <p>Dear ${name},</p>
        <p>We regret to inform you that your manuscript "<strong>${manuscriptTitle}</strong>" was not approved for publication at this time.</p>
    `;
    if (feedbackComments) {
      bodyContent += `
        <div class="feedback">
            <p><strong>Feedback from the Editor:</strong></p>
            <p>${feedbackComments}</p>
        </div>
      `;
    }
    bodyContent += `
        <p>We appreciate the time and effort you put into your manuscript.</p>
        <p>While it wasn't selected this time, we encourage you to consider the feedback and submit a manuscript again in the future.</p>
      `;
  } else {
    subjectLine = 'Update on your Manuscript Submission';
    bodyContent = `
        <p>Dear ${name},</p>
        <p>This is an update regarding your manuscript "<strong>${manuscriptTitle}</strong>". Its current status is: <strong>${status}</strong>.</p>
    `;
  }

  return `
<html>
<head>
    <style type="text/css">
        ${commonStyles}
        .feedback {
            background-color: #f0f0f0;
            border-left: 4px solid #ccc;
            margin: 10px 0;
            padding: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${subjectLine}</h1>
    </div>
    
    <div class="content">
        ${bodyContent}
    </div>
    
    ${commonFooter}
</body>
</html>
`;
};