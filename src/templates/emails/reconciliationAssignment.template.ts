import { commonStyles, commonFooter } from './styles';

export const reconciliationAssignmentTemplate = (
  reviewerName: string,
  manuscriptTitle: string,
  reviewUrl: string,
  dueDate: Date
): string => `
<html>
<head>
    <style type="text/css">
        ${commonStyles}
        .discrepancy-notice {
            color: #8B008B;
            font-weight: bold;
            padding: 10px;
            background-color: #f8e0f5;
            border-left: 3px solid #7A0019;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Reconciliation Review Assignment</h1>
    </div>
    
    <div class="content">
        <p>Dear <strong>${reviewerName}</strong>,</p>
        
        <p>You have been assigned as a reconciliation reviewer for the manuscript titled:</p>
        
        <div class="proposal-title">"${manuscriptTitle}"</div>
        
        <p class="discrepancy-notice">This manuscript has received conflicting decisions from the initial reviewers, requiring a reconciliation review.</p>
        
        <p>Your task is to provide an independent assessment to help resolve the discrepancy. Please complete your reconciliation review by:</p>
        
        <p class="deadline-notice"><strong>${new Date(
    dueDate
  ).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}</strong></p>
        
        <a href="${reviewUrl}" class="button">Start Reconciliation Review</a>
        
        <p>Your expert judgment is vital in ensuring a fair and thorough evaluation process for this manuscript.</p>
        
        <p>For any questions regarding this reconciliation assignment, please contact the editorial office.</p>
    </div>
    
    ${commonFooter}
</body>
</html>
`;
