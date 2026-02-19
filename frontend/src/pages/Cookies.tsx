import LegalLayout from '../components/landing/LegalLayout';

export default function Cookies() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="February 17, 2026">
      <p>
        This Cookie Policy explains how Plainer ("we", "us", or "our") uses cookies and
        similar technologies when you use our web application (the "Service").
      </p>

      <h2>1. What Are Cookies</h2>
      <p>
        Cookies are small text files stored on your device by your web browser. They allow
        websites to remember information about your visit, such as your login status and
        preferences. Similar technologies include local storage and session storage, which
        serve comparable purposes.
      </p>

      <h2>2. Cookies We Use</h2>

      <h3>Essential Cookies</h3>
      <p>
        These cookies are strictly necessary for the Service to function. They cannot be
        disabled without breaking core functionality.
      </p>
      <ul>
        <li>
          <strong>Authentication tokens</strong> — Stored in local storage to keep you signed
          in across sessions. Contains your JWT access token and refresh token.
        </li>
        <li>
          <strong>Session state</strong> — Maintains your current workspace, selected file,
          and panel layout preferences during your session.
        </li>
      </ul>

      <h3>Functional Cookies</h3>
      <p>
        These cookies remember your preferences and settings to provide an enhanced experience.
      </p>
      <ul>
        <li>
          <strong>UI preferences</strong> — Sidebar collapsed state, chat panel visibility,
          and other layout preferences.
        </li>
        <li>
          <strong>API key storage</strong> — If you provide your own Anthropic API key, it is
          stored locally for convenience (encrypted on the server, reference stored locally).
        </li>
      </ul>

      <h2>3. What We Do Not Use</h2>
      <p>We want to be transparent about what we do <strong>not</strong> do:</p>
      <ul>
        <li>We do <strong>not</strong> use third-party tracking cookies</li>
        <li>We do <strong>not</strong> use advertising cookies</li>
        <li>We do <strong>not</strong> use analytics cookies from third-party providers</li>
        <li>We do <strong>not</strong> sell or share cookie data with advertisers</li>
        <li>We do <strong>not</strong> track you across other websites</li>
      </ul>

      <h2>4. Managing Cookies</h2>
      <p>
        Since we only use essential and functional cookies required for the Service to work,
        disabling them may prevent you from using the Service properly. You can manage cookies
        through your browser settings:
      </p>
      <ul>
        <li>
          <strong>Clear cookies:</strong> You can delete all cookies from your browser settings.
          This will sign you out and reset your preferences.
        </li>
        <li>
          <strong>Block cookies:</strong> You can configure your browser to block cookies, but
          this will prevent you from signing in to the Service.
        </li>
        <li>
          <strong>Local storage:</strong> You can clear local storage through your browser's
          developer tools (typically under Application &gt; Local Storage).
        </li>
      </ul>

      <h2>5. Data Stored Locally</h2>
      <p>
        In addition to cookies, we use browser local storage to persist the following data
        on your device:
      </p>
      <ul>
        <li>Authentication tokens (access token and refresh token)</li>
        <li>User profile information (name, email) for display purposes</li>
        <li>Application state preferences (panel sizes, view selections)</li>
      </ul>
      <p>
        This data remains on your device until you sign out or manually clear your browser
        storage. It is never transmitted to third parties.
      </p>

      <h2>6. Changes to This Policy</h2>
      <p>
        We may update this Cookie Policy if we change how we use cookies or similar
        technologies. We will update the "Last updated" date and, for significant changes,
        notify you through the Service.
      </p>

      <h2>7. Contact Us</h2>
      <p>
        If you have any questions about our use of cookies, please contact us at{' '}
        <a href="mailto:privacy@plainer.app">privacy@plainer.app</a>.
      </p>
    </LegalLayout>
  );
}
