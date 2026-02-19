import LegalLayout from '../components/landing/LegalLayout';

export default function AcceptableUse() {
  return (
    <LegalLayout title="Acceptable Use Policy" lastUpdated="February 17, 2026">
      <p>
        This Acceptable Use Policy ("Policy") outlines the rules and guidelines for using the
        Plainer web application and services (the "Service"). This Policy is part of our{' '}
        <a href="/terms">Terms of Service</a>. By using the Service, you agree to comply with
        this Policy.
      </p>

      <h2>1. General Conduct</h2>
      <p>You agree to use the Service responsibly and in a manner that:</p>
      <ul>
        <li>Complies with all applicable laws and regulations</li>
        <li>Respects the rights and privacy of other users</li>
        <li>Does not interfere with the normal operation of the Service</li>
        <li>Does not compromise the security of the Service or other users' accounts</li>
      </ul>

      <h2>2. Prohibited Content</h2>
      <p>You may not use the Service to store, create, share, or distribute:</p>
      <ul>
        <li>Content that violates any applicable law or regulation</li>
        <li>Content that infringes on intellectual property rights of others</li>
        <li>Malware, viruses, or any other malicious code</li>
        <li>Content designed to phish, scam, or defraud others</li>
        <li>Content that promotes violence, hatred, or discrimination</li>
        <li>Child sexual abuse material (CSAM) or content that exploits minors</li>
        <li>Non-consensual intimate imagery</li>
        <li>Spam or unsolicited bulk content</li>
      </ul>

      <h2>3. Prohibited Activities</h2>
      <p>You may not:</p>
      <ul>
        <li>Attempt to access other users' accounts, files, or workspaces without authorization</li>
        <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
        <li>Use automated tools (bots, scrapers) to access the Service without permission</li>
        <li>Attempt to overload, disrupt, or compromise the Service's infrastructure</li>
        <li>Circumvent any access controls, rate limits, or security measures</li>
        <li>Impersonate another person or entity</li>
        <li>Use the Service to send spam, phishing emails, or other unsolicited communications</li>
        <li>Resell, redistribute, or sublicense access to the Service</li>
        <li>Use the Service to develop a competing product</li>
      </ul>

      <h2>4. AI Usage Guidelines</h2>
      <p>When using the AI agent features, you agree not to:</p>
      <ul>
        <li>Attempt to make the AI generate harmful, illegal, or deceptive content</li>
        <li>Use AI-generated content to impersonate real individuals</li>
        <li>
          Represent AI-generated content as human-created in contexts where disclosure is
          required by law or professional standards
        </li>
        <li>Use the AI to process data you do not have the right to process</li>
        <li>
          Attempt to extract the AI's system prompts, training data, or internal instructions
        </li>
      </ul>

      <h2>5. Marketplace Guidelines</h2>
      <p>When publishing items to the marketplace, you agree to:</p>
      <ul>
        <li>Only publish content you have the right to share</li>
        <li>Provide accurate descriptions of your published items</li>
        <li>Not include malicious code, tracking scripts, or deceptive functionality</li>
        <li>Not publish items that violate any section of this Policy</li>
        <li>Respect other users' marketplace contributions</li>
      </ul>

      <h2>6. Resource Usage</h2>
      <p>
        You agree to use the Service's resources (storage, processing, API calls) reasonably
        and not engage in activities designed to consume excessive resources, including but not
        limited to:
      </p>
      <ul>
        <li>Uploading excessively large files beyond reasonable workspace needs</li>
        <li>Making an unreasonable volume of API calls</li>
        <li>Using the AI agent in a manner that generates excessive costs</li>
        <li>Creating an unreasonable number of accounts</li>
      </ul>

      <h2>7. Reporting Violations</h2>
      <p>
        If you become aware of any content or activity that violates this Policy, please report
        it to us at <a href="mailto:abuse@plainer.app">abuse@plainer.app</a>. We take reports
        seriously and will investigate promptly.
      </p>

      <h2>8. Enforcement</h2>
      <p>
        We reserve the right to take any action we deem appropriate in response to violations
        of this Policy, including but not limited to:
      </p>
      <ul>
        <li>Issuing a warning</li>
        <li>Removing content that violates the Policy</li>
        <li>Temporarily suspending your account</li>
        <li>Permanently terminating your account</li>
        <li>Reporting violations to law enforcement if required</li>
      </ul>
      <p>
        We will endeavor to notify you of enforcement actions when appropriate, but reserve the
        right to take immediate action without notice in cases of severe violations.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Policy from time to time. Material changes will be communicated
        through the Service. Your continued use after changes constitutes acceptance of the
        updated Policy.
      </p>

      <h2>10. Contact Us</h2>
      <p>
        If you have any questions about this Policy, please contact us at{' '}
        <a href="mailto:legal@plainer.app">legal@plainer.app</a>.
      </p>
    </LegalLayout>
  );
}
