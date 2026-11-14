export type MailTemplate =
  | { template: 'verify_email'; data: { name: string; link: string } }
  | { template: 'password_reset'; data: { name: string; link: string } }
  | { template: 'password_changed'; data: { name: string } }
  | { template: 'installation_verified'; data: { name: string; websiteName: string; domain: string; link: string } }
  | { template: 'invitation'; data: { inviterName: string; organizationName: string; roleLabel: string; link: string } };

export type MailJob = MailTemplate & { to: string };

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px">
<tr><td style="padding:28px 32px 8px;font-size:18px;font-weight:700;color:#071225">Ledora</td></tr>
<tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.6"><h1 style="font-size:20px;margin:0 0 12px;color:#071225">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
</table></body></html>`;
}

function button(link: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#5B2BE0;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>
<p style="font-size:13px;color:#64748b">If the button does not work, paste this link into your browser:<br>${escapeHtml(link)}</p>`;
}

export function renderMail(job: MailTemplate): RenderedMail {
  switch (job.template) {
    case 'verify_email': {
      const { name, link } = job.data;
      return {
        subject: 'Verify your email address',
        text: `Hi ${name},\n\nConfirm your email address to finish setting up Ledora:\n${link}\n\nThe link expires in 24 hours. If you did not create an account, ignore this email.`,
        html: layout('Verify your email address', `<p>Hi ${escapeHtml(name)},</p><p>Confirm your email address to finish setting up Ledora.</p>${button(link, 'Verify email')}<p style="font-size:13px;color:#64748b">The link expires in 24 hours. If you did not create an account, ignore this email.</p>`),
      };
    }
    case 'password_reset': {
      const { name, link } = job.data;
      return {
        subject: 'Reset your Ledora password',
        text: `Hi ${name},\n\nSomeone asked to reset your Ledora password. Use this link within 1 hour:\n${link}\n\nIf it was not you, ignore this email; your password stays the same.`,
        html: layout('Reset your password', `<p>Hi ${escapeHtml(name)},</p><p>Someone asked to reset your Ledora password. The link works for 1 hour.</p>${button(link, 'Choose a new password')}<p style="font-size:13px;color:#64748b">If it was not you, ignore this email; your password stays the same.</p>`),
      };
    }
    case 'password_changed': {
      const { name } = job.data;
      return {
        subject: 'Your Ledora password was changed',
        text: `Hi ${name},\n\nYour Ledora password was just changed and all other sessions were signed out. If this was not you, reset your password immediately and contact support.`,
        html: layout('Your password was changed', `<p>Hi ${escapeHtml(name)},</p><p>Your Ledora password was just changed and all other sessions were signed out.</p><p>If this was not you, reset your password immediately and contact support.</p>`),
      };
    }
    case 'installation_verified': {
      const { name, websiteName, domain, link } = job.data;
      return {
        subject: `Ledora is receiving data from ${domain}`,
        text: `Hi ${name},\n\nGood news: Ledora just received its first visit from ${websiteName} (${domain}). Your installation is working.\n\nOpen the website in Ledora:\n${link}`,
        html: layout('Your installation is working', `<p>Hi ${escapeHtml(name)},</p><p>Ledora just received its first visit from <strong>${escapeHtml(websiteName)}</strong> (${escapeHtml(domain)}). Your installation is working.</p>${button(link, 'Open website')}`),
      };
    }
    case 'invitation': {
      const { inviterName, organizationName, roleLabel, link } = job.data;
      return {
        subject: `${inviterName} invited you to ${organizationName} on Ledora`,
        text: `${inviterName} invited you to join ${organizationName} on Ledora as ${roleLabel}.\n\nAccept the invitation:\n${link}\n\nThe invitation expires in 7 days.`,
        html: layout(`Join ${organizationName} on Ledora`, `<p>${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(organizationName)}</strong> as <strong>${escapeHtml(roleLabel)}</strong>.</p>${button(link, 'Accept invitation')}<p style="font-size:13px;color:#64748b">The invitation expires in 7 days.</p>`),
      };
    }
  }
}
