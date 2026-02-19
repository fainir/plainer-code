import LegalLayout from '../components/landing/LegalLayout';

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="February 17, 2026">
      <p>
        These Terms of Service ("Terms") govern your access to and use of the Plainer web
        application and services (the "Service") provided by Plainer ("we", "us", or "our").
        By accessing or using the Service, you agree to be bound by these Terms.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By creating an account or using the Service, you confirm that you are at least 13 years
        of age and have the legal capacity to enter into these Terms. If you are using the
        Service on behalf of an organization, you represent that you have the authority to bind
        that organization to these Terms.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        Plainer is an AI-powered workspace that provides file management, multi-view data
        visualization, an AI assistant agent, marketplace for community apps and templates,
        and collaboration features. The Service allows you to create, upload, organize, and
        share files, as well as interact with an AI agent that can read, create, and modify
        your files.
      </p>

      <h2>3. Accounts</h2>
      <ul>
        <li>You must provide accurate and complete information when creating an account.</li>
        <li>You are responsible for maintaining the security of your account credentials.</li>
        <li>You are responsible for all activity that occurs under your account.</li>
        <li>You must notify us immediately of any unauthorized access to your account.</li>
        <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
      </ul>

      <h2>4. Your Content</h2>
      <h3>Ownership</h3>
      <p>
        You retain all ownership rights to the files, documents, and other content you create
        or upload to the Service ("Your Content"). We do not claim any ownership over Your Content.
      </p>

      <h3>License to Us</h3>
      <p>
        By uploading or creating content on the Service, you grant us a limited, non-exclusive
        license to store, process, and display Your Content solely for the purpose of providing
        and improving the Service. This includes sending content to third-party AI providers
        for processing when you use AI features.
      </p>

      <h3>Marketplace Content</h3>
      <p>
        If you publish apps, templates, or commands to the marketplace, you grant other users
        a non-exclusive license to use, install, and run your published items within the
        Service. You represent that you have the right to grant this license.
      </p>

      <h2>5. Acceptable Use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Violate any applicable law or regulation</li>
        <li>Infringe on the intellectual property rights of others</li>
        <li>Upload or transmit malicious code, viruses, or harmful content</li>
        <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
        <li>Use the Service to generate, store, or distribute illegal content</li>
        <li>Interfere with or disrupt the Service or its infrastructure</li>
        <li>Engage in any activity that could harm other users</li>
        <li>Use automated means to access the Service without our permission</li>
        <li>Resell or redistribute the Service without authorization</li>
      </ul>
      <p>
        For the complete policy, see our <a href="/acceptable-use">Acceptable Use Policy</a>.
      </p>

      <h2>6. AI Features</h2>
      <ul>
        <li>
          The AI agent is provided "as is" and may produce inaccurate, incomplete, or
          inappropriate content. You are responsible for reviewing and verifying any
          AI-generated content.
        </li>
        <li>
          AI-generated files and views are Your Content and are subject to the same terms.
        </li>
        <li>
          We use third-party AI providers (currently Anthropic) to power AI features. Your
          interactions with the AI agent are subject to the provider's terms and policies.
        </li>
        <li>
          If you provide your own API key, you are responsible for any charges incurred with
          the AI provider.
        </li>
      </ul>

      <h2>7. Intellectual Property</h2>
      <p>
        The Service, including its design, code, features, and branding, is owned by Plainer
        and protected by intellectual property laws. You may not copy, modify, distribute, or
        create derivative works of the Service without our written permission.
      </p>

      <h2>8. Third-Party Services</h2>
      <p>
        The Service integrates with third-party services, including AI providers and cloud
        storage. We are not responsible for the availability, accuracy, or policies of
        third-party services. Your use of third-party services is subject to their respective
        terms and privacy policies.
      </p>

      <h2>9. Service Availability</h2>
      <p>
        We strive to maintain high availability but do not guarantee uninterrupted access to
        the Service. We may modify, suspend, or discontinue any part of the Service at any
        time. We will make reasonable efforts to notify you of significant changes.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, the Service is provided "as is" and "as
        available" without warranties of any kind. We shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages, including loss of data,
        profits, or business opportunities, arising from your use of the Service.
      </p>
      <p>
        Our total aggregate liability for any claims related to the Service shall not exceed
        the amount you paid us in the twelve months preceding the claim, or $100, whichever
        is greater.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold us harmless from any claims, damages, losses, and
        expenses (including reasonable attorney's fees) arising from your use of the Service,
        your violation of these Terms, or your violation of any rights of another party.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may terminate your account at any time by contacting us. We may suspend or
        terminate your access to the Service at any time for violation of these Terms or for
        any other reason with reasonable notice. Upon termination, your right to use the
        Service ceases immediately, though we may retain Your Content for a reasonable period
        to allow you to export your data.
      </p>

      <h2>13. Governing Law</h2>
      <p>
        These Terms shall be governed by and construed in accordance with applicable law,
        without regard to conflict of law principles. Any disputes arising from these Terms
        shall be resolved through binding arbitration or in the courts of competent
        jurisdiction.
      </p>

      <h2>14. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of material changes
        by posting the updated Terms on the Service. Your continued use of the Service after
        such changes constitutes your acceptance of the updated Terms.
      </p>

      <h2>15. Contact Us</h2>
      <p>
        If you have any questions about these Terms, please contact us at{' '}
        <a href="mailto:legal@plainer.app">legal@plainer.app</a>.
      </p>
    </LegalLayout>
  );
}
