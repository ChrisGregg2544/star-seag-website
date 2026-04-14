# STAR AI Tutor — Supabase Email Templates

Paste each template into the Supabase Dashboard:  
**Authentication → Email Templates** → select template type → paste HTML into the body field and update the subject line.

Brand colours: Navy `#0F172A` · Gold `#C9A84C` · White `#FFFFFF`

---

## 1. CONFIRM SIGNUP

**Subject:** Confirm your STAR AI Tutor account

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your STAR AI Tutor account</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:#0F172A;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <!-- Star SVG logo -->
              <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 14px;">
                <polygon points="20,4 24.5,14.5 36,15.5 27.5,23.5 30,35 20,29.5 10,35 12.5,23.5 4,15.5 15.5,14.5" fill="#C9A84C"/>
              </svg>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#C9A84C;letter-spacing:0.08em;">STAR AI Tutor</div>
              <div style="font-size:11px;font-weight:700;color:rgba(201,168,76,0.6);letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Transfer Test Preparation</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e8edf2;border-right:1px solid #e8edf2;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F172A;font-family:Georgia,'Times New Roman',serif;">Welcome to STAR AI Tutor!</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#3a5070;">
                Thanks for signing up. You're one step away from giving your child the best possible preparation for the transfer test.
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#3a5070;">
                Please confirm your email address by clicking the button below. This link expires in 24 hours.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#C9A84C;border-radius:10px;text-align:center;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#0F172A;text-decoration:none;letter-spacing:0.03em;">
                      Confirm My Account
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                If you didn't create a STAR AI Tutor account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e8edf2;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
                Questions? Email us at <a href="mailto:staraitutor.support@gmail.com" style="color:#C9A84C;text-decoration:none;">staraitutor.support@gmail.com</a>
              </p>
              <p style="margin:0;font-size:12px;color:#c0ccd8;">
                &copy; 2026 STAR AI Tutor · Northern Ireland
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
```

---

## 2. PASSWORD RESET

**Subject:** Reset your STAR AI Tutor password

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your STAR AI Tutor password</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:#0F172A;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 14px;">
                <polygon points="20,4 24.5,14.5 36,15.5 27.5,23.5 30,35 20,29.5 10,35 12.5,23.5 4,15.5 15.5,14.5" fill="#C9A84C"/>
              </svg>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#C9A84C;letter-spacing:0.08em;">STAR AI Tutor</div>
              <div style="font-size:11px;font-weight:700;color:rgba(201,168,76,0.6);letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Transfer Test Preparation</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e8edf2;border-right:1px solid #e8edf2;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F172A;font-family:Georgia,'Times New Roman',serif;">Reset your password</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#3a5070;">
                We received a request to reset the password for your STAR AI Tutor account.
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#3a5070;">
                Click the button below to choose a new password. This link expires in 1 hour.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#C9A84C;border-radius:10px;text-align:center;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#0F172A;text-decoration:none;letter-spacing:0.03em;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email — your password will not be changed.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e8edf2;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
                Questions? Email us at <a href="mailto:staraitutor.support@gmail.com" style="color:#C9A84C;text-decoration:none;">staraitutor.support@gmail.com</a>
              </p>
              <p style="margin:0;font-size:12px;color:#c0ccd8;">
                &copy; 2026 STAR AI Tutor · Northern Ireland
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
```

---

## 3. MAGIC LINK

**Subject:** Your STAR AI Tutor login link

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your STAR AI Tutor login link</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:#0F172A;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 14px;">
                <polygon points="20,4 24.5,14.5 36,15.5 27.5,23.5 30,35 20,29.5 10,35 12.5,23.5 4,15.5 15.5,14.5" fill="#C9A84C"/>
              </svg>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#C9A84C;letter-spacing:0.08em;">STAR AI Tutor</div>
              <div style="font-size:11px;font-weight:700;color:rgba(201,168,76,0.6);letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Transfer Test Preparation</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e8edf2;border-right:1px solid #e8edf2;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0F172A;font-family:Georgia,'Times New Roman',serif;">Here's your login link</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#3a5070;">
                Click the button below to sign in to your STAR AI Tutor account instantly — no password needed.
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#3a5070;">
                This link can only be used once and expires in 1 hour.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#C9A84C;border-radius:10px;text-align:center;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#0F172A;text-decoration:none;letter-spacing:0.03em;">
                      Sign In to STAR
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                If you didn't request this link, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e8edf2;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
                Questions? Email us at <a href="mailto:staraitutor.support@gmail.com" style="color:#C9A84C;text-decoration:none;">staraitutor.support@gmail.com</a>
              </p>
              <p style="margin:0;font-size:12px;color:#c0ccd8;">
                &copy; 2026 STAR AI Tutor · Northern Ireland
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
```

---

## Notes

- All templates use table-based layout for maximum email client compatibility (Gmail, Outlook, Apple Mail)
- Inline styles only — no external CSS
- `{{ .ConfirmationURL }}` is Supabase's built-in template variable — do not change it
- SVG logos render in most modern email clients; Gmail on Android may not show SVG — the fallback is the text "STAR AI Tutor" below it which always renders
- To apply: Supabase Dashboard → Authentication → Email Templates → select type → paste HTML body → update Subject line → Save
