I don't want you to take any actions just take everything I'm sending as context; this was the first prompt I sent: This is what I use currently for my email templates, I do it in my node.js backend and I'm able to use css and beautify them and then send them I want to know if it's possible to do something that lets you create this templates on the go something really customizable but using my current templates as context, like I should be able to say this is the header and then write the text for that, it'll follow the color already being used , then if there are things I want to add, or words I want to bolden or basically the extra stuff do with the css and all and then being able to set the subject and then after all this I can click on preview to see how the mail will look like when it's sent to someone. check all the relevant files and then tell me what you think because I'm trying to you to create and send me a custom prompt to implement all that for this my project that I can give to a model that has context of every file you want it to have context of. The prompt handles both the frontend and the backend implementation and how they integrate too. This was the response I got: 1 Role: Senior Full Stack Developer (Node.js/TypeScript, React, Ant Design).
    2
    3 Context:
    4 I am working on the "UBJH_server" project (University of Benin Journal of Humanities).
    5 - Backend: Node.js, Express, TypeScript, Nodemailer.
    6 - Frontend: React, Ant Design.
    7 - Email System: We currently use hardcoded string templates in src/templates/emails/ and a singleton service
      src/services/email.service.ts to send emails.
    8
    9 Goal:
   10 I need a "Dynamic Email Builder" feature that allows admins to create, preview, and send custom emails "on the go" while strictly adhering to      our existing brand identity (colors, headers, footers).
   11
   12 Requirements:
   13
   14 ### 1. Backend Implementation (Node.js/Express)
   15
   16 A. Refactor for Reusability
   17 Currently, our templates (like authorInvitation.template.ts) manually inject commonStyles and commonFooter.
   18 - Create a new helper function src/templates/emails/baseLayout.ts.
   19 - It should accept title (string) and content (html string).
   20 - It must wrap them in the standard HTML structure found in src/templates/emails/styles.ts (using commonStyles in the <head> and       
      commonFooter at the bottom).
   21 - Ensure it uses our primary color #7A0019 for the header background as defined in commonStyles.
   22
   23 B. Email Service Update
   24 - Update src/services/email.service.ts.
   25 - Add a generic method sendDynamicEmail(to: string, subject: string, htmlContent: string).
   26 - It should use the existing this.transporter to send the mail.
   27
   28 C. New Controller & Routes
   29 - Create src/controllers/admin/dynamicEmail.controller.ts.
   30 - Implement two endpoints:
   31   1.  POST /preview: Receives { headerTitle, bodyContent }. Returns the full HTML string (using the baseLayout helper) so the frontend 
      can render it.
   32   2.  POST /send: Receives { to, subject, headerTitle, bodyContent }. Generates the HTML and sends it using
      emailService.sendDynamicEmail.
   33
   34 ### 2. Frontend Implementation (React + Ant Design)
   35
   36 A. Email Builder Component
   37 - Create a new page/component EmailTemplateBuilder.
   38 - Use Ant Design Form for layout.
   39 - Inputs:
   40   - Recipient Email (Input)
   41   - Subject Line (Input)
   42   - Header Title (Input - this appears in the red bar inside the email)
   43   - Body Content: Use a rich text editor (recommend react-quill or a similar lightweight library) so I can bold text, add links, and form      lists. If not available, use a standard Input.TextArea but allow HTML tags.
   44
   45 B. Live Preview
   46 - Add a "Preview" button.
   47 - When clicked, send the form data to the backend /preview endpoint.
   48 - Display the returned HTML in a Modal or a clean container using an iframe (to ensure CSS isolation) or dangerouslySetInnerHTML.        
   49 - This allows me to see exactly how the commonStyles (fonts, colors) look before sending.
   50
   51 C. Sending
   52 - Add a "Send Email" button.
   53 - On success, show an Ant Design notification.success.
   54
   55 Code Style & Constraints:
   56 - Use strict TypeScript.
   57 - Follow the existing folder structure (src/controllers, src/routes, src/templates).
   58 - Ensure the "Body Content" injected into the template supports basic HTML (bold, italics, breaks) but is sanitized to prevent XSS if necessa      (though this is an admin tool).
   59 - Crucial: The generated email MUST look identical to our system emails (like authorInvitation) by using the exact CSS from
      src/templates/emails/styles.ts.

  ---

  This was the next prompt I sent next: wait check the models and even one controller as context, I want to be able to type my text in an interface and then send mails to the submitters/authors, like any of them that's selected almost like sending a mail but not using predefined content for the templates I don't know if you understand me and this was the response gotten: 1 Role: Senior Full Stack Developer (Node.js/TypeScript, React, Ant Design).
    2
    3 Context:
    4 I am working on the "UBJH_server" project.
    5 - Backend: Node.js, Express, TypeScript, Mongoose, Nodemailer.
    6 - Frontend: React, Ant Design.
    7 - Core Models: User (roles: admin, author, reviewer), Manuscript (status: submitted, approved, rejected, etc.).
    8
    9 Goal:
   10 I need a "Custom Email Campaign" feature for Admins. It must allow me to:
   11 1.  Select Recipients: Filter users based on their role OR their manuscript status (e.g., "All authors with Rejected manuscripts") and
      select specific individuals from that list.
   12 2.  Compose Email: Write a custom subject, header, and body (Rich Text).
   13 3.  Preview: See exactly how it looks with our strict branding (colors, headers, footers).
   14 4.  Send: Bulk send the customized email to the selected recipients.
   15
   16 Requirements:
   17
   18 ### 1. Backend Implementation (Node.js/Express)
   19
   20 A. Template Engine Refactor (Crucial for Consistency)
   21 - Create src/templates/emails/baseLayout.ts.
   22 - It acts as a wrapper function: (title: string, content: string) => string.
   23 - It imports commonStyles and commonFooter from src/templates/emails/styles.ts.
   24 - It returns the full HTML string with the standard <head>, <body>, red header bar (Color: #7A0019), and footer.
   25
   26 B. New Controller: `src/controllers/admin/customEmail.controller.ts`
   27 - Endpoint 1: `GET /admin/email/recipients`
   28   - Query Params: role (optional), manuscriptStatus (optional).
   29   - Logic:
   30     - If manuscriptStatus is provided: Query Manuscript model for that status, populate submitter, and return unique users.
   31     - If role is provided: Query User model directly.
   32     - Return format: [{ _id, name, email, role, latestManuscriptStatus }].
   33 - Endpoint 2: `POST /admin/email/preview`
   34   - Body: { headerTitle, bodyContent }.
   35   - Returns: The final HTML string using baseLayout.
   36 - Endpoint 3: `POST /admin/email/send`
   37   - Body: { recipientIds: string[], subject, headerTitle, bodyContent }.
   38   - Logic:
   39     - Validate recipientIds.
   40     - Loop through IDs to find user emails (optimize with User.find({ _id: { $in: recipientIds } })).
   41     - Use emailService.transporter.sendMail to send to each user.
   42     - Note: Send individually (or BCC if appropriate, but individual is preferred for delivery rates) to avoid exposing other emails.    
   43
   44 ### 2. Frontend Implementation (React + Ant Design)
   45
   46 Page: `CustomEmailSender`
   47
   48 Step 1: Recipient Selection
   49 - Use an Ant Design Table with rowSelection (checkboxes).
   50 - Filters (Top Bar):
   51   - Role Dropdown: (All, Author, Reviewer).
   52   - Manuscript Status Dropdown: (All, Submitted, Under Review, Approved, Rejected).
   53   - "Fetch Users" button to apply filters.
   54 - Table Columns: Name, Email, Role, Affiliation.
   55 - Show a summary: "Selected 15 users".
   56
   57 Step 2: Email Composition
   58 - Input Fields:
   59   - Subject Line (e.g., "Important Update regarding your submission").
   60   - Header Title (The text that appears in the red bar, e.g., "Journal Update").
   61   - Body Content: Use a Rich Text Editor (like react-quill) to allow bolding, lists, and links.
   62
   63 Step 3: Preview & Send
   64 - "Preview Email" Button: Opens a Modal showing the HTML returned from /preview. Use an iframe or shadow DOM to ensure styles don't  
      conflict, but it MUST show the commonStyles (red header, grey background) correctly.
   65 - "Send to X Recipients" Button: Calls /admin/email/send.
   66 - Show a progress indicator or success notification upon completion.
   67
   68 Code Style:
   69 - Strictly follow the project's folder structure.
   70 - Ensure type safety (Interfaces for API responses).
   71 - Security: Ensure only Admins can access these endpoints (use existing admin middleware). Then I wanted to try to find a hybrid, I like the first  prompt it gave details on the how, code details a bit, the second prompt contains what I wanted to actually do and then when I had a new idea to add to it I then used this prompt again: I don't want that test mail stuff tho. I'm using Next.js with typescript and tailwind css for the frontend and also scrap the test feature, also I want the separate email to each submitter apart from the bulk sending but yeah the bulk sending I need an intuitive way to be able to add the people I want to send to not just based on filter but also on just random selection by the admin, also I'll need a dynamic text integration in the sense that if I'm send a mail I want to be able to add a name field that when that mail is sent, it'll be sent with the user names of each of those submitters selected, I could add the dynamic text manuscript title which will send the title of the submitter/authors manuscript in the part of the content of the mail where the dynamic text was sent, I don't know if you get what I'm saying and also the prompt should try to adapt for the project and try to find out when given context other examples of dynamic text that, that specific project will need, maybe name, manuscript title and other that are already being used in the templates. this was the response gotten: Role: Senior Full Stack Developer (Node.js/Express, Next.js/TypeScript, Tailwind CSS).

Context: I am working on the "UBJH" (University of Benin Journal of Humanities) platform.

Backend: Node.js, Express, TypeScript, Mongoose, Nodemailer.

Frontend: Next.js (App Router), TypeScript, Tailwind CSS, ShadcnUI (or Headless UI).

Core Models:

User: { name, email, role (admin, author, reviewer), affiliation }

Manuscript: { title, status, submitter (ref to User), manuscriptId }

Branding: Primary Red: #7A0019.

Goal: I need a "Smart Email Campaign Manager" for Admins. It must allow flexible recipient selection (filters + manual additions) and support Dynamic Variable Injection (e.g., "Dear {{name}}, regarding {{manuscriptTitle}}...") where the system automatically replaces placeholders with the specific data for each recipient during the sending process.

Requirements:

1. Backend Implementation (Node.js/Express)
A. Variable Replacement Logic (The "Mail Merge" Engine)

In src/services/email.service.ts, create a helper replaceVariables(template: string, data: any): string.

It should use regex to replace standard placeholders.

Contextual Variables to Support:

{{name}}: The user's full name.

{{email}}: The user's email.

{{role}}: The user's role.

{{manuscriptTitle}}: Title of their latest/active manuscript.

{{manuscriptId}}: The unique ID of their submission.

{{manuscriptStatus}}: Current status (e.g., "Under Review").

B. Controller: src/controllers/admin/campaign.controller.ts

Endpoint 1: GET /recipients

Support complex filtering:

role: "author", "reviewer".

status: "rejected", "approved".

search: Fuzzy search by name or email (for manually finding specific users).

Crucial: The response must include the user's data plus their latest manuscript data so the frontend knows what dynamic info is available.

Endpoint 2: POST /send-campaign

Body: { recipients: UserID[], subject, headerTitle, bodyContent }.

Execution Logic:

Fetch all Users and their related Manuscripts based on the recipients array (IDs).

Iterate through each user individually.

Run replaceVariables on the bodyContent using that specific user's data (e.g., replace {{manuscriptTitle}} with their specific title).

Call emailService.sendMail for that individual.

(Performance Note: Use Promise.allSettled to handle the batch without blocking).

2. Frontend Implementation (Next.js + Tailwind CSS)
Page: /admin/email-campaign

Section A: The "Smart" Recipient Selector

Layout: A split view or a 2-step wizard.

Filter Area: Dropdowns for Role and Manuscript Status to bulk-fetch users (e.g., "Get all Rejected Authors").

Manual Search: A Search Bar to find individual users (e.g., "John Doe") and append them to the list manually.

Selection List:

Display a list of selected users (using a clean Tailwind Table or Cards).

Show columns: Name, Role, Associated Manuscript Title (so I know what {{manuscriptTitle}} will resolve to).

Allow removing individuals from the list.

Section B: Dynamic Composer

Inputs: Subject, Header Title.

Rich Text Editor: Use a library compatible with Next.js (e.g., Tiptap or React-Quill).

"Variable Chips" Toolbar:

Above the editor, display clickable "Variable Chips" styled with Tailwind (e.g., bg-gray-200 rounded-full px-2).

Chips: Insert Name, Insert Manuscript Title, Insert Manuscript ID, Insert Status.

Action: Clicking a chip inserts the placeholder (e.g., {{manuscriptTitle}}) into the editor at the cursor position.

Section C: Preview & Send

Live Preview: A button that opens a Modal.

It should take the first person in the selected list and show a "Real World Example" by rendering the HTML with that person's actual data (replacing {{name}} with "Dr. Akeem", etc.) so I can verify the dynamic text works.

Send Button: "Send to [X] Recipients".

Styling Constraints:

Use the project's Tailwind config (Primary: #7A0019).

Ensure the email output (HTML) is fully responsive and matches the existing hardcoded branding.

