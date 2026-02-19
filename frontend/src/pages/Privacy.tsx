import LegalLayout from '../components/landing/LegalLayout';

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="February 17, 2026">
      <p>
        This Privacy Policy describes how Plainer ("we", "us", or "our") collects, uses, and
        shares your personal information when you use our web application and services
        (collectively, the "Service").
      </p>

      <h2>1. Information We Collect</h2>

      <h3>Account Information</h3>
      <p>
        When you create an account, we collect your name, email address, and password. Passwords
        are securely hashed and never stored in plain text.
      </p>

      <h3>Files and Content</h3>
      <p>
        You may upload, create, or generate files and content within the Service. This includes
        documents, spreadsheets, code files, images, custom views, and any other data you store
        in your workspace. We store this content to provide the Service to you.
      </p>

      <h3>AI Conversations</h3>
      <p>
        When you interact with the Plainer AI agent, we store your conversation history
        (messages you send and responses received) to provide conversation continuity and
        improve the Service. Your conversations may be sent to third-party AI providers
        (currently Anthropic) for processing.
      </p>

      <h3>Usage Data</h3>
      <p>
        We automatically collect certain information when you use the Service, including your
        IP address, browser type, operating system, referring URLs, pages viewed, and
        actions taken within the application.
      </p>

      <h3>API Keys</h3>
      <p>
        If you provide your own Anthropic API key, it is stored encrypted on our servers and
        used solely to make API calls on your behalf. We never share your API key with third
        parties.
      </p>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, maintain, and improve the Service</li>
        <li>Process and store your files and workspace data</li>
        <li>Facilitate AI-powered features including file creation, editing, and visualization</li>
        <li>Authenticate your identity and secure your account</li>
        <li>Send you important Service-related notifications</li>
        <li>Respond to your support requests</li>
        <li>Detect, prevent, and address technical issues or abuse</li>
      </ul>

      <h2>3. How We Share Your Information</h2>
      <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
      <ul>
        <li>
          <strong>AI Processing:</strong> Your AI conversations and relevant file content are
          sent to Anthropic's API to generate responses. This data is subject to{' '}
          <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer">
            Anthropic's privacy policy
          </a>.
        </li>
        <li>
          <strong>File Sharing:</strong> When you share files or folders with other users, those
          users will be able to access the shared content according to the permissions you set.
        </li>
        <li>
          <strong>Marketplace:</strong> If you publish apps, templates, or commands to the
          marketplace, the content and your display name will be visible to other users.
        </li>
        <li>
          <strong>Service Providers:</strong> We use third-party services to host and operate
          the Service (including cloud hosting, storage, and database providers).
        </li>
        <li>
          <strong>Legal Requirements:</strong> We may disclose your information if required by
          law, court order, or governmental authority.
        </li>
      </ul>

      <h2>4. Data Storage and Security</h2>
      <p>
        Your data is stored on secure servers provided by our cloud hosting partners. We use
        industry-standard encryption for data in transit (TLS/SSL) and implement reasonable
        security measures to protect your data at rest. File storage uses either local
        encrypted storage or Amazon S3 with server-side encryption.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain your account data and files for as long as your account is active. When you
        delete files, they are soft-deleted and may be permanently removed after a retention
        period. If you delete your account, we will delete your personal data within 30 days,
        except where we are required to retain it for legal or regulatory purposes.
      </p>

      <h2>6. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Export your data in a portable format</li>
        <li>Object to or restrict certain processing of your data</li>
        <li>Withdraw consent where processing is based on consent</li>
      </ul>
      <p>
        To exercise these rights, please contact us at{' '}
        <a href="mailto:privacy@plainer.app">privacy@plainer.app</a>.
      </p>

      <h2>7. Cookies</h2>
      <p>
        We use essential cookies and local storage to maintain your authentication session and
        application preferences. We do not use third-party tracking or advertising cookies. For
        more details, see our <a href="/cookies">Cookie Policy</a>.
      </p>

      <h2>8. Children's Privacy</h2>
      <p>
        The Service is not intended for children under the age of 13. We do not knowingly
        collect personal information from children under 13. If you believe we have collected
        such information, please contact us immediately.
      </p>

      <h2>9. International Data Transfers</h2>
      <p>
        Your data may be transferred to and processed in countries other than your country of
        residence. We take appropriate measures to ensure your data receives an adequate level
        of protection in accordance with applicable data protection laws.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any material
        changes by posting the updated policy on the Service with a new "Last updated" date.
        Your continued use of the Service after such changes constitutes your acceptance of the
        updated policy.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy or our data practices, please
        contact us at <a href="mailto:privacy@plainer.app">privacy@plainer.app</a>.
      </p>
    </LegalLayout>
  );
}
