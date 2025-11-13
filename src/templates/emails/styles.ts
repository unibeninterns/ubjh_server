export const commonStyles = `
body {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    line-height: 1.55;
    color: #212121;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f9f9f9;
}
.header {
    background: #7A0019;
    color: #fff;
    padding: 24px 16px;
    text-align: center;
}
.content {
    padding: 15px;
    background-color: #ffffff;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}
.proposal-title {
    font-size: 18px;
    color: #7A0019;
    padding: 10px;
    background-color: #F2E9EC;
    border-left: 3px solid #7A0019;
    margin: 15px 0;
}
.button {
    display: inline-block;
    padding: 10px 20px;
    background-color: #7A0019;
    color: white !important;
    text-decoration: none;
    border-radius: 4px;
    margin: 15px 0;
    font-weight: bold;
}
.footer {
    background:#faf7f8;
    padding:16px;
    font-size:14px;
    color:#444;
    border-top:1px solid #ead3d9;
    text-align: center;
}
.credentials {
    background-color: #F2E9EC;
    padding: 15px;
    border-left: 3px solid #7A0019;
    margin: 15px 0;
}`;

export const commonFooter = `
<div class="footer">
    <p>© ${new Date().getFullYear()} University of Benin — UNIBEN Journal of Humanities • Crossref DOIs • Google Scholar-ready • Preserved via PKP PN</p>
</div>`;

/**
 * @deprecated Use commonStyles instead
 */
export const submissionConfirmationStyles = `
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333333;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
}
.header {
    color: #7A0019;
    border-bottom: 2px solid #7A0019;
    padding-bottom: 10px;
    margin-bottom: 20px;
}
.content {
    padding: 10px 0;
}
.footer {
    margin-top: 30px;
    padding-top: 15px;
    border-top: 1px solid #e0e0e0;
    font-size: 14px;
    color: #666666;
}
.highlight {
    color: #7A0019;
    font-weight: bold;
}`;

/**
 * @deprecated Use commonFooter instead
 */
export const submissionConfirmationFooter = `
<div class="footer">
    <p><strong>Best regards,</strong></p>
    <p>Directorate of Research, Innovation and Development<br>
    University of Benin<br>
    PMB 1154, Benin City, Nigeria</p>
</div>`;

/**
 * @deprecated Use commonStyles instead
 */
export const statusUpdateStyles = `
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333333;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f9f9f9;
}
h1 {
    color: #7A0019;
    border-bottom: 2px solid #7A0019;
    padding-bottom: 10px;
    margin-bottom: 20px;
}
p {
    margin: 10px 0;
}
strong {
    color: #7A0019;
}
a {
    display: inline-block;
    padding: 10px 20px;
    background-color: #7A0019;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    margin: 15px 0;
    font-weight: bold;
}`;
