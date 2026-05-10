# STAR AI Tutor — Supabase Email Templates

Paste each template into the Supabase Dashboard:  
**Authentication → Email Templates** → select template type → paste HTML into the body field → update the Subject line → Save.

Brand colours: Orange `#F97316` · Cream `#FEF3E2` · Dark text `#1A1A1A`

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
<body style="margin:0;padding:0;background:#FEF3E2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF3E2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:#F97316;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <svg width="44" height="44" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 12px;">
                <rect width="40" height="40" rx="10" fill="#F59E0B"/>
                <polygon points="20,7 23.5,15.5 33,16.3 26.5,22.5 28.5,32 20,27.5 11.5,32 13.5,22.5 7,16.3 16.5,15.5" fill="#ffffff"/>
              </svg>
              <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.06em;">STAR AI Tutor</div>
              <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Transfer Test Preparation</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #F0E0C0;border-right:1px solid #F0E0C0;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1A1A1A;">Welcome to STAR AI Tutor!</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#555555;">
                Thanks for signing up. You're one step away from giving your child the best possible preparation for the SEAG Transfer Test.
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#555555;">
                Please confirm your email address by clicking the button below. This link expires in 24 hours.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#F97316;border-radius:10px;box-shadow:0 4px 0 #EA6C0A;text-align:center;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.03em;">
                      Confirm My Account →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#999999;line-height:1.6;">
                If you didn't create a STAR AI Tutor account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#FEF3E2;border:1px solid #F0E0C0;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#999999;">
                Questions? Email us at <a href="mailto:staraitutor.support@gmail.com" style="color:#F97316;text-decoration:none;">staraitutor.support@gmail.com</a>
              </p>
              <p style="margin:0;font-size:12px;color:#BBBBBB;">
                &copy; 2026 STAR AI Tutor &middot; Northern Ireland
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
<body style="margin:0;padding:0;background:#FEF3E2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF3E2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:#F97316;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <svg width="44" height="44" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 12px;">
                <rect width="40" height="40" rx="10" fill="#F59E0B"/>
                <polygon points="20,7 23.5,15.5 33,16.3 26.5,22.5 28.5,32 20,27.5 11.5,32 13.5,22.5 7,16.3 16.5,15.5" fill="#ffffff"/>
              </svg>
              <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.06em;">STAR AI Tutor</div>
              <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Transfer Test Preparation</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #F0E0C0;border-right:1px solid #F0E0C0;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1A1A1A;">Reset your password</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#555555;">
                We received a request to reset the password for your STAR AI Tutor account.
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#555555;">
                Click the button below to choose a new password. This link expires in 1 hour.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#F97316;border-radius:10px;box-shadow:0 4px 0 #EA6C0A;text-align:center;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.03em;">
                      Reset My Password →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#999999;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email — your password will not be changed.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#FEF3E2;border:1px solid #F0E0C0;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#999999;">
                Questions? Email us at <a href="mailto:staraitutor.support@gmail.com" style="color:#F97316;text-decoration:none;">staraitutor.support@gmail.com</a>
              </p>
              <p style="margin:0;font-size:12px;color:#BBBBBB;">
                &copy; 2026 STAR AI Tutor &middot; Northern Ireland
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
<body style="margin:0;padding:0;background:#FEF3E2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF3E2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:#F97316;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <svg width="44" height="44" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 12px;">
                <rect width="40" height="40" rx="10" fill="#F59E0B"/>
                <polygon points="20,7 23.5,15.5 33,16.3 26.5,22.5 28.5,32 20,27.5 11.5,32 13.5,22.5 7,16.3 16.5,15.5" fill="#ffffff"/>
              </svg>
              <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.06em;">STAR AI Tutor</div>
              <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">Transfer Test Preparation</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #F0E0C0;border-right:1px solid #F0E0C0;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1A1A1A;">Here's your login link</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#555555;">
                Click the button below to sign in to your STAR AI Tutor account instantly — no password needed.
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#555555;">
                This link can only be used once and expires in 1 hour.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#F97316;border-radius:10px;box-shadow:0 4px 0 #EA6C0A;text-align:center;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.03em;">
                      Sign In to STAR →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#999999;line-height:1.6;">
                If you didn't request this link, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#FEF3E2;border:1px solid #F0E0C0;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#999999;">
                Questions? Email us at <a href="mailto:staraitutor.support@gmail.com" style="color:#F97316;text-decoration:none;">staraitutor.support@gmail.com</a>
              </p>
              <p style="margin:0;font-size:12px;color:#BBBBBB;">
                &copy; 2026 STAR AI Tutor &middot; Northern Ireland
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
- To apply: Supabase Dashboard → Authentication → Email Templates → select type → paste HTML → update Subject line → Save
