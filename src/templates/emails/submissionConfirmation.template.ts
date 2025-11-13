import { commonStyles, commonFooter } from './styles';

export const submissionConfirmationTemplate = (
  name: string,
  title: string,
  loginUrl: string,
  isRevision = false
): string => {
  const subject = isRevision
    ? 'Manuscript Revision Confirmation'
    : 'Manuscript Submission Confirmation';
  const body = isRevision
    ? `<p>Thank you for submitting your revised manuscript titled <strong class="highlight">"${title}"</strong>.</p><p>Your revision has been received and is now under review.</p>`
    : `<p>Thank you for submitting your manuscript titled <strong class="highlight">"${title}"</strong>.</p><p>Your submission has been received and is now under review by our committee.</p>`;

  const loginInfo = isRevision
    ? `<p>You can check the status of your submission by logging into your account: <a href="${loginUrl}" class="button">Login</a></p>`
    : '<p>You will receive your login credentials via your primary author email at any period within 24 hours to 7 days, which you can use to track the progress of your submission.</p>';

  return `
<html>
<head>
    <style type="text/css">
        ${commonStyles}
    </style>
</head>
<body>
    <div class="header">
        <h1>${subject}</h1>
    </div>
    
    <div class="content">
        <p>Dear ${name},</p>
        
        ${body}

        ${loginInfo}
        
        <p>We appreciate your contribution to the research community at the University of Benin. You will receive further communication regarding the status of your submission as soon as possible</p>
    </div>
    
    ${commonFooter}
</body>
</html>
`;
};
