import { commonStyles, commonFooter } from './styles';

export const manuscriptArchiveNotificationTemplate = (
  name: string,
  manuscriptTitle: string,
  isArchived: boolean,
  comment?: string
): string => `
<html>
<head>
    <style type="text/css">
        ${commonStyles}
    </style>
</head>
<body>
    <div class="header">
        <h1>Your Manuscript Has Been ${isArchived ? 'Archived' : 'Unarchived'}</h1>
    </div>
    
    <div class="content">
        <p>Dear ${name},</p>
        <p>We wish to inform you that your manuscript titled "<strong>${manuscriptTitle}</strong>" has been ${isArchived ? 'archived' : 'unarchived'}.</p>
        ${isArchived ? '<p>This means it will no longer appear in your active manuscripts list, but remains accessible for record-keeping.</p>' : ''}
        ${comment ? `<p><strong>Reason:</strong> ${comment}</p>` : ''}
        <p>If you have any questions, please contact the editorial office.</p>
        <p>Sincerely,</p>
        <p>DRID</p>
    </div>
    
    ${commonFooter}
</body>
</html>
`;
