// KCAL email template helpers — Resend için DRY layout + components.
// Tüm kullanıcı maillerinde ortak header/footer/button stili.

interface MailLayout {
  preheader: string;
  body: string;
  recipientEmail: string;
}

export const escapeHtml = (s: string | number | null | undefined): string => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const layout = ({ preheader, body, recipientEmail }: MailLayout): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#FFFFFF;">
  <span style="display:none;color:#0A0A0A;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" border="0" style="background:#141414;border-radius:20px;padding:40px;max-width:520px;width:100%;">

        <tr><td style="padding-bottom:32px;border-bottom:1px solid #232323;">
          <span style="color:#FFFFFF;font-size:22px;font-weight:500;letter-spacing:-0.6px;">
            kcal<span style="color:#C8F03C;">.</span>
          </span>
        </td></tr>

        <tr><td style="padding:32px 0 0;">
          ${body}
        </td></tr>

        <tr><td style="padding-top:40px;color:rgba(255,255,255,0.4);font-size:11px;line-height:18px;">
          <div style="border-top:1px solid #232323;padding-top:24px;">
            Bu mail ${escapeHtml(recipientEmail)} adresine gönderildi.<br>
            Sorular için: <a href="mailto:hello@eatkcal.com" style="color:#C8F03C;text-decoration:none;">hello@eatkcal.com</a> &nbsp;|&nbsp; <a href="tel:02323322100" style="color:#C8F03C;text-decoration:none;">0232 33 22 100</a><br><br>
            KCAL — Sekulart Sağlıklı Gıda, Karabağlar / İzmir
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

export const button = (href: string, label: string): string => `
<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td style="background:#C8F03C;border-radius:100px;">
    <a href="${escapeHtml(href)}" style="color:#0A0A0A;text-decoration:none;font-size:14px;font-weight:500;letter-spacing:-0.2px;display:block;padding:14px 32px;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;

export const orderRow = (label: string, price: string): string => `
<tr>
  <td style="padding:12px 0;border-bottom:1px solid #232323;color:rgba(255,255,255,0.85);font-size:14px;">
    ${escapeHtml(label)}
  </td>
  <td style="padding:12px 0;border-bottom:1px solid #232323;color:#FFFFFF;font-size:14px;text-align:right;font-weight:500;">
    ${escapeHtml(price)}
  </td>
</tr>`;

export const highlightCard = (caption: string, value: string): string => `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1F2A1A;border:1px solid #C8F03C;border-radius:14px;margin-bottom:24px;">
  <tr><td style="padding:20px 24px;">
    <div style="color:rgba(200,240,60,0.7);font-size:10px;letter-spacing:1.2px;font-weight:500;text-transform:uppercase;margin-bottom:4px;">
      ${escapeHtml(caption)}
    </div>
    <div style="color:#C8F03C;font-size:24px;font-weight:500;letter-spacing:-0.4px;font-family:'SF Mono',Monaco,Menlo,monospace;">
      ${escapeHtml(value)}
    </div>
  </td></tr>
</table>`;
