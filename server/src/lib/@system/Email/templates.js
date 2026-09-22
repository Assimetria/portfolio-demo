// @system — HTML email templates
// Each export is a function that accepts template-specific variables and returns
// a complete HTML string suitable for sending as an email body.
//
// Design: table-based layout for maximum email-client compatibility,
// inline styles only, neutral dark/light palette that works for any brand.

'use strict'

// ── Shared layout helpers ─────────────────────────────────────────────────────

function appName() {
  return process.env.APP_NAME ?? 'App'
}

function appUrl() {
  return process.env.APP_URL ?? 'http://localhost:5173'
}

function supportEmail() {
  return process.env.SUPPORT_EMAIL ?? null
}

/**
 * Wrap inner content in the standard email card shell.
 * @param {object} opts
 * @param {string} opts.content     HTML to render inside the card body
 * @param {string} [opts.preheader] Inbox preview text (hidden in body, visible in clients)
 */
function shell({ content, preheader = '' }) {
  const name = appName()
  const url = appUrl()
  const support = supportEmail()
  const year = new Date().getFullYear()

  const preheaderHtml = preheader
    ? `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f9fafb">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>`
    : ''

  const footerSupport = support
    ? `<tr><td style="padding-top:6px;font-size:13px;color:#9ca3af;text-align:center">Questions? <a href="mailto:${support}" style="color:#6b7280;text-decoration:underline">${support}</a></td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <title>${name}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  ${preheaderHtml}

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;padding:40px 16px">
    <tr>
      <td align="center" valign="top">

        <!-- Card: max 580px -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%">

          <!-- Logo row -->
          <tr>
            <td align="left" style="padding-bottom:20px">
              <a href="${url}" style="font-size:22px;font-weight:700;color:#111827;text-decoration:none;letter-spacing:-0.5px">${name}</a>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">

              <!-- Body -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:36px 36px 28px">
                    ${content}
                  </td>
                </tr>
              </table>

              <!-- Footer inside card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #f3f4f6;background-color:#f9fafb">
                <tr>
                  <td style="padding:20px 36px 24px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:12px;color:#9ca3af;text-align:center">&copy; ${year} ${name}. All rights reserved.</td>
                      </tr>
                      ${footerSupport}
                      <tr>
                        <td style="padding-top:6px;font-size:12px;color:#d1d5db;text-align:center">
                          You received this because of your activity on <a href="${url}" style="color:#d1d5db;text-decoration:underline">${name}</a>.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Primary CTA button. */
function btn(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px">
    <tr>
      <td style="border-radius:8px;background-color:#111827">
        <a href="${href}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:-0.2px;line-height:1">${label}</a>
      </td>
    </tr>
  </table>`
}

/** Muted fallback URL shown under the CTA. */
function fallbackLink(href) {
  return `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#9ca3af">
    Or copy this link into your browser:<br>
    <a href="${href}" style="color:#6b7280;word-break:break-all;text-decoration:underline">${href}</a>
  </p>`
}

/** Section divider. */
function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
    <tr><td style="border-top:1px solid #f3f4f6;font-size:0;line-height:0">&nbsp;</td></tr>
  </table>`
}

// ── Templates ─────────────────────────────────────────────────────────────────

/**
 * Email-address verification template.
 * @param {{ name?: string, verifyUrl: string }} opts
 */
function verification({ name, verifyUrl }) {
  const displayName = name ? `Hi ${name},` : 'Hi there,'
  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">Verify your email address</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">${displayName}</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      Thanks for signing up. Please confirm your email address to activate your account.
    </p>
    ${btn('Verify Email', verifyUrl)}
    ${divider()}
    <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af">
      This link expires in <strong style="color:#6b7280">24 hours</strong>.
      If you didn't create an account, you can safely ignore this email.
    </p>
    ${fallbackLink(verifyUrl)}`

  return shell({
    content,
    preheader: `Confirm your email to activate your ${appName()} account.`,
  })
}

/**
 * Welcome email sent after a user's email is verified.
 * @param {{ name?: string, appUrl: string, appName: string }} opts
 */
function welcome({ name, appUrl: url, appName: productName }) {
  const displayName = name ?? 'there'
  const dashboardUrl = `${url ?? appUrl()}/app`
  const product = productName ?? appName()

  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">Welcome to ${product}!</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">Hi ${displayName},</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      Your account is ready. Here's what you can do next:
    </p>

    <!-- Checklist card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <tr><td style="background-color:#f9fafb;padding:16px 20px">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em">Getting started</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#374151">
              <span style="color:#10b981;font-weight:700;margin-right:8px">&#10003;</span>Account created
            </td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#374151">
              <span style="color:#10b981;font-weight:700;margin-right:8px">&#10003;</span>Email verified
            </td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#9ca3af">
              <span style="margin-right:8px">&#10230;</span>Complete your profile
            </td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#9ca3af">
              <span style="margin-right:8px">&#10230;</span>Explore the dashboard
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    ${btn('Go to dashboard', dashboardUrl)}
    ${divider()}
    <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af">
      Need help? Visit our <a href="${url ?? appUrl()}/help" style="color:#6b7280;text-decoration:underline">help center</a>
      or reply to this email.
    </p>`

  return shell({
    content,
    preheader: `Welcome to ${product} — your account is ready.`,
  })
}

/**
 * Password reset email.
 * @param {{ name?: string, resetUrl: string }} opts
 */
function passwordReset({ name, resetUrl }) {
  const displayName = name ? `Hi ${name},` : 'Hi there,'

  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">Reset your password</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">${displayName}</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      We received a request to reset the password for your account.
      Click the button below to choose a new one.
    </p>
    ${btn('Reset Password', resetUrl)}
    ${divider()}
    <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af">
      This link expires in <strong style="color:#6b7280">1 hour</strong>.
      If you didn't request a password reset, you can safely ignore this email — your password will not change.
    </p>
    ${fallbackLink(resetUrl)}`

  return shell({
    content,
    preheader: 'Reset your password — this link expires in 1 hour.',
  })
}

/**
 * Team / workspace invitation email.
 * @param {{ inviterName: string, orgName: string, inviteUrl: string }} opts
 */
function invitation({ inviterName, orgName, inviteUrl }) {
  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">You've been invited</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">
      <strong style="color:#374151">${inviterName}</strong> has invited you to join
      <strong style="color:#374151">${orgName}</strong> on ${appName()}.
    </p>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      Click the button below to accept the invitation and get started.
    </p>
    ${btn('Accept Invitation', inviteUrl)}
    ${divider()}
    <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af">
      This invitation expires in <strong style="color:#6b7280">7 days</strong>.
      If you weren't expecting this, you can safely ignore this email.
    </p>
    ${fallbackLink(inviteUrl)}`

  return shell({
    content,
    preheader: `${inviterName} invited you to join ${orgName} on ${appName()}.`,
  })
}

/**
 * Magic-link (passwordless) login email.
 * @param {{ name?: string, magicUrl: string }} opts
 */
function magicLink({ name, magicUrl }) {
  const displayName = name ? `Hi ${name},` : 'Hi there,'

  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">Your sign-in link</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">${displayName}</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      Click the button below to sign in to your ${appName()} account. No password needed.
    </p>
    ${btn('Sign In', magicUrl)}
    ${divider()}
    <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af">
      This link expires in <strong style="color:#6b7280">15 minutes</strong> and can only be used once.
      If you didn't request this, you can safely ignore this email.
    </p>
    ${fallbackLink(magicUrl)}`

  return shell({
    content,
    preheader: `Your ${appName()} sign-in link — expires in 15 minutes.`,
  })
}

/**
 * Generic notification email with an optional CTA button.
 * @param {{ title: string, body: string, ctaLabel?: string, ctaUrl?: string }} opts
 */
function notification({ title, body, ctaLabel, ctaUrl }) {
  const ctaHtml = ctaLabel && ctaUrl ? btn(ctaLabel, ctaUrl) + fallbackLink(ctaUrl) : ''

  const content = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">${title}</h1>
    <div style="font-size:15px;line-height:1.7;color:#374151">${body}</div>
    ${ctaHtml}`

  return shell({
    content,
    preheader: title,
  })
}

/**
 * Confirmation that an account password was changed.
 * @param {{ name?: string, helpUrl?: string }} opts
 */
function passwordChanged({ name, helpUrl }) {
  const displayName = name ? `Hi ${name},` : 'Hi there,'

  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">Your password was changed</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">${displayName}</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      The password for your ${appName()} account was recently changed.
      If this was you, no further action is needed.
    </p>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      If you don't recognize this change, please contact support right away and reset your password immediately.
    </p>
    ${divider()}
    ${helpUrl ? `${btn('Secure my account', helpUrl)}${fallbackLink(helpUrl)}` : ''}`

  return shell({
    content,
    preheader: `Your ${appName()} password was changed.`,
  })
}

/**
 * Notice that the account email address is being changed.
 * @param {{ name?: string, newEmail?: string, securityUrl?: string }} opts
 */
function emailChange({ name, newEmail, securityUrl }) {
  const displayName = name ? `Hi ${name},` : 'Hi there,'

  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">Your email address is changing</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">${displayName}</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      ${newEmail ? `We're updating the email address on your ${appName()} account to <strong style="color:#374151">${newEmail}</strong>.` : `We're updating the email address on your ${appName()} account.`}
    </p>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      If you made this change, you can ignore this message. If you didn't, your account may be compromised and you should review your security settings.
    </p>
    ${divider()}
    ${securityUrl ? `${btn('Review account', securityUrl)}${fallbackLink(securityUrl)}` : ''}`

  return shell({
    content,
    preheader: `Your ${appName()} email address is being changed.`,
  })
}

/**
 * Alert a workspace owner / admin that a new user signed up.
 * @param {{ userName?: string, userEmail?: string, plan?: string, adminUrl?: string }} opts
 */
function signupAlert({ userName, userEmail, plan, adminUrl }) {
  const who = userName ? `${userName}${userEmail ? ` (${userEmail})` : ''}` : (userEmail ?? 'A new user')
  const planText = plan ? ` on the <strong style="color:#374151">${plan}</strong> plan` : ''

  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">New signup on ${appName()}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">
      <strong style="color:#374151">${who}</strong> just created an account${planText}.
    </p>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      You can review the new workspace or reach out to welcome them.
    </p>
    ${adminUrl ? `${btn('Open admin panel', adminUrl)}${fallbackLink(adminUrl)}` : ''}`

  return shell({
    content,
    preheader: `A new user just signed up on ${appName()}.`,
  })
}

/**
 * Confirmation / receipt sent after a successful payment.
 * @param {{ name?: string, amount?: string, invoiceUrl?: string, planName?: string }} opts
 */
function paymentReceipt({ name, amount, invoiceUrl, planName }) {
  const displayName = name ? `Hi ${name},` : 'Hi there,'
  const amountHtml = amount
    ? `<strong style="color:#111827;font-size:18px">${amount}</strong>${planName ? ` for <strong style="color:#374151">${planName}</strong>` : ''}`
    : `<strong style="color:#374151">${planName ?? 'your subscription'}</strong>`

  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">Thank you for your payment</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">${displayName}</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      We've received your payment of ${amountHtml}.
    </p>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      A receipt is available in your billing dashboard at any time.
    </p>
    ${invoiceUrl ? `${btn('View invoice', invoiceUrl)}${fallbackLink(invoiceUrl)}` : ''}`

  return shell({
    content,
    preheader: `Thanks ${name ?? ''} — payment received${planName ? ` for ${planName}` : ''}.`,
  })
}

/**
 * Confirmation that a subscription has been canceled.
 * @param {{ name?: string, planName?: string, reactivateUrl?: string }} opts
 */
function subscriptionCanceled({ name, planName, reactivateUrl }) {
  const displayName = name ? `Hi ${name},` : 'Hi there,'
  const planText = planName ? ` to ${planName}` : ''

  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">Your subscription has been canceled</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">${displayName}</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      Just confirming that your ${appName()} subscription${planText} has been canceled.
      You won't be charged again, and your access will continue until the end of the current billing period.
    </p>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      If you change your mind, you can reactivate your subscription at any time.
    </p>
    ${reactivateUrl ? `${btn('Reactivate subscription', reactivateUrl)}${fallbackLink(reactivateUrl)}` : ''}`

  return shell({
    content,
    preheader: `Your ${appName()} subscription${planName ? ` to ${planName}` : ''} has been canceled.`,
  })
}

/**
 * Alert sent when a recurring payment fails to go through. The subscription
 * generally stays active through a short grace period, so this prompts the user
 * to update their payment method before access is interrupted.
 * @param {{ name?: string, amount?: string, planName?: string, billingUrl?: string }} opts
 */
function paymentFailed({ name, amount, planName, billingUrl }) {
  const displayName = name ? `Hi ${name},` : 'Hi there,'
  const planText = planName ? ` for ${planName}` : ''
  const amountHtml = amount
    ? `<strong style="color:#111827;font-size:18px">${amount}</strong>${planText}`
    : `<strong style="color:#374151">${planName ?? 'your subscription'}</strong>`

  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">Your payment didn't go through</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">${displayName}</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      We couldn't process a payment of ${amountHtml}. Your account stays active for now, but we'll keep trying over the next few days.
    </p>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      To avoid any interruption, please update your payment method. If your card details are correct and you still see a failed charge, <a href="mailto:${supportEmail() ?? ''}" style="color:#374151;text-decoration:underline">contact support</a>.
    </p>
    ${billingUrl ? `${btn('Update payment method', billingUrl)}${fallbackLink(billingUrl)}` : ''}`

  return shell({
    content,
    preheader: `Your ${appName()} payment didn't go through${planName ? ` for ${planName}` : ''}.`,
  })
}

/**
 * Security notice about a sign-in from a new device / location.
 * @param {{ name?: string, device?: string, location?: string, ip?: string, reviewUrl?: string }} opts
 */
function newDeviceNotice({ name, device, location, ip, reviewUrl }) {
  const displayName = name ? `Hi ${name},` : 'Hi there,'
  const contextBits = [device, location, ip].filter(Boolean)
  const contextHtml = contextBits.length
    ? `<strong style="color:#374151">${contextBits.join(' &middot; ')}</strong>`
    : 'a new device'

  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">New sign-in to your account</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">${displayName}</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      We noticed a new sign-in to your ${appName()} account from ${contextHtml}.
    </p>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      If this was you, you're all set. If not, secure your account immediately.
    </p>
    ${reviewUrl ? `${btn('Review activity', reviewUrl)}${fallbackLink(reviewUrl)}` : ''}`

  return shell({
    content,
    preheader: 'A new device just signed in to your ' + appName() + ' account.',
  })
}

/**
 * First-login invitation: an admin provisioned an account and the user must
 * choose a password before signing in for the first time.
 * @param {{ name?: string, setPasswordUrl: string }} opts
 */
function setPassword({ name, setPasswordUrl }) {
  const displayName = name ? `Hi ${name},` : 'Hi there,'
  const content = `
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#111827;line-height:1.2;letter-spacing:-0.5px">Welcome to ${appName()}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#6b7280">${displayName}</p>
    <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#6b7280">
      An administrator has created your ${appName()} account. To finish setting it up and sign in for the first time, choose a password using the button below.
    </p>
    <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#9ca3af">
      This link expires in <strong style="color:#6b7280">7 days</strong>. If you didn't expect this email, you can safely ignore it.
    </p>
    ${setPasswordUrl ? btn('Set your password', setPasswordUrl) : ''}`
  // Deliberately no plain-text fallbackLink(): the one-time token must appear
  // exactly once (inside the button href) so it never lands in quoted replies
  // or plain-text previews.

  return shell({
    content,
    preheader: `Set a password to activate your ${appName()} account.`,
  })
}

module.exports = {
  verification,
  welcome,
  passwordReset,
  invitation,
  magicLink,
  notification,
  passwordChanged,
  emailChange,
  signupAlert,
  paymentReceipt,
  subscriptionCanceled,
  paymentFailed,
  newDeviceNotice,
  setPassword,
}
