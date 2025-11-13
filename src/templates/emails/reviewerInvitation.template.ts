import { commonStyles, commonFooter } from './styles';

export const reviewerInvitationTemplate = (inviteUrl: string): string => `
<html>
<head>
    <style type="text/css">
        ${commonStyles}
    </style>
</head>
<body>
    <div class="header">
        <h1>Invitation to Become a Reviewer</h1>
    </div>
    
    <div class="content">
        <p>Dear Prospective Reviewer,</p>
        
        <p>We are pleased to invite you to become a reviewer for the University of Benin Journal of Humanities (UBJH). Your expertise in your field would be invaluable to our peer-review process, helping us to ensure the quality and integrity of the research we publish.</p>
        
        <p>As a reviewer, you will play a crucial role in evaluating manuscript submissions, providing constructive feedback to authors, and contributing to the advancement of knowledge in humanities.</p>
        
        <p>To accept this invitation and create your reviewer profile, please click the button below:</p>
        
        <a href="${inviteUrl}" class="button">Accept Invitation & Complete Profile</a>
        
        <p>This invitation link is valid for 30 days. If you have any questions or are unable to participate at this time, please do not hesitate to contact us. Contact support at drid@uniben.edu</p>
        
        <p>Thank you for considering this important role. We look forward to your positive response.</p>
    </div>
    
    ${commonFooter}
</body>
</html>
`;
