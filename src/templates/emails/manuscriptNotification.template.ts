import { commonStyles, commonFooter } from './styles';

export const manuscriptNotificationTemplate = (
  author: string,
  manuscriptTitle: string,
  reviewUrl: string
): string => `
<html>
<head>
    <style type="text/css">
        ${commonStyles}
    </style>
</head>
<body>
    <div class="header">
        <h1>New Manuscript Submission</h1>
    </div>
    
    <div class="content">
        <p><strong>${author}</strong> has submitted a new manuscript titled:</p>
        
        <div class="manuscript-title">"${manuscriptTitle}"</div>
        
        <p>Please log in to the portal to review this manuscript at your earliest convenience.</p>
        
        <a href="${reviewUrl}" class="button">Review Manuscript Now</a>
    </div>
    
    ${commonFooter}
</body>
</html>
`;
