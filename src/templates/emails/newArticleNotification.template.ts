import { commonStyles, commonFooter } from './styles';

export const newArticleNotificationTemplate = (
  title: string,
  authorName: string,
  articleId: string,
  unsubscribeToken: string
): string => {
  const articleUrl = `${process.env.FRONTEND_URL}/articles/${articleId}`;
  const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe/${unsubscribeToken}`;

  return `
<html>
<head>
    <style type="text/css">
        ${commonStyles}
        .unsubscribe { color: #999; font-size: 11px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>New Article Published!</h1>
    </div>
    
    <div class="content">
        <p>A new article has been published in UNIBEN Journal of Humanities:</p>
        
        <div class="article-title">${title}</div>
        
        <p><strong>Author:</strong> ${authorName}</p>
        
        <p>Click the button below to read the full article:</p>
        
        <a href="${articleUrl}" class="button">Read Article</a>
        
        <p>Thank you for your continued interest in our research!</p>

        <p>You can unsubscribe at any time by clicking the link below:</p>
        
        <a href="${unsubscribeUrl}" class="button">Unsubscribe</a>
    </div>
    
    ${commonFooter}
</body>
</html>
`;
};
