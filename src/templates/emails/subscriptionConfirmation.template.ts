import { commonStyles, commonFooter } from './styles';

export const subscriptionConfirmationTemplate = (
  email: string,
  unsubscribeToken: string
): string => {
  const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe/${unsubscribeToken}`;

  return `
<html>
<head>
    <style type="text/css">
        ${commonStyles}
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to UBJH Updates!</h1>
    </div>
    
    <div class="content">
        <p>Thank you for subscribing to UNIBEN Journal of Humanities email alerts!</p>
        
        <p>You will now receive notifications when new articles are published in our journal.</p>
        
        <p>You can unsubscribe at any time by clicking the link below:</p>
        
        <a href="${unsubscribeUrl}" class="button">Unsubscribe</a>
        
        <p>If you have any questions, please don't hesitate to contact us.</p>
    </div>
    
    ${commonFooter}
</body>
</html>
`;
};
