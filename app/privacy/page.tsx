import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Privacy Policy - Omnisound",
  description: "Privacy Policy for Omnisound",
}

export default function PrivacyPolicyPage() {
  const lastUpdated = "December 30, 2024"
  const effectiveDate = "December 30, 2024"

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-8">
          Last updated: {lastUpdated} | Effective: {effectiveDate}
        </p>

        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">1. Introduction</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              Welcome to Omnisound ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you use our AI-powered assistant application available at
              earai.vercel.app (the "Service").
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              We are committed to protecting your privacy and handling your data in an open and transparent manner. By
              using our Service, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">
              2.1 Information You Provide Directly
            </h3>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>
                <strong>Account Information:</strong> When you create an account, we collect your name, email address,
                and password (encrypted).
              </li>
              <li>
                <strong>Voice Data:</strong> When you use voice features, we process your audio input to provide
                transcription and AI responses. Audio is processed in real-time and is not permanently stored.
              </li>
              <li>
                <strong>User Content:</strong> Notes, preferences, and other content you create within the app.
              </li>
            </ul>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">
              2.2 Information from Third-Party Services
            </h3>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>
                <strong>Google Account:</strong> If you sign in with Google, we receive your name, email address, and
                profile picture from Google.
              </li>
              <li>
                <strong>Google Calendar:</strong> With your explicit permission, we access your Google Calendar data to
                display your schedule and help manage calendar events. This includes event titles, times, descriptions,
                and attendee information.
              </li>
            </ul>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">
              2.3 Automatically Collected Information
            </h3>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>
                <strong>Usage Data:</strong> Information about how you interact with our Service, including features
                used and time spent.
              </li>
              <li>
                <strong>Device Information:</strong> Browser type, operating system, and device identifiers.
              </li>
              <li>
                <strong>Log Data:</strong> IP address, access times, and pages viewed.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">3. How We Use Your Information</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process and respond to your voice commands and queries</li>
              <li>Display your calendar events and help you manage your schedule</li>
              <li>Create and manage your account</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, investigate, and prevent fraudulent transactions and abuse</li>
              <li>Personalize and improve your experience</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
              4. Google User Data - Limited Use Disclosure
            </h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-4">
              <p className="text-zinc-700 dark:text-zinc-200 mb-4">
                <strong>Omnisound's use and transfer of information received from Google APIs adheres to the</strong>{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
            </div>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">
              4.1 Google Calendar Data Usage
            </h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">We access Google Calendar data solely to:</p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>Display your upcoming events within the Omnisound app</li>
              <li>Create, modify, or delete calendar events at your explicit request</li>
              <li>Provide proactive reminders about your schedule</li>
              <li>Help you manage your time through AI-powered suggestions</li>
            </ul>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">4.2 Limited Use Commitments</h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">We commit to the following:</p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>
                We will <strong>only use</strong> Google user data for providing and improving the features described in
                this policy
              </li>
              <li>
                We will <strong>not transfer</strong> Google user data to third parties except as necessary to provide
                the Service, comply with laws, or as part of a merger/acquisition with user consent
              </li>
              <li>
                We will <strong>not use</strong> Google user data for serving advertisements
              </li>
              <li>
                We will <strong>not allow humans to read</strong> Google user data unless we have your affirmative
                consent, it's necessary for security purposes, to comply with laws, or our use is limited to internal
                operations
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">5. Data Sharing and Disclosure</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              We do not sell, trade, or rent your personal information. We may share your information only in the
              following circumstances:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>
                <strong>Service Providers:</strong> With third-party vendors who perform services on our behalf (e.g.,
                hosting, analytics, AI processing) under strict confidentiality agreements
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law, regulation, or legal process
              </li>
              <li>
                <strong>Protection of Rights:</strong> To protect the rights, property, or safety of Omnisound, our
                users, or others
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, with
                appropriate notice to users
              </li>
              <li>
                <strong>With Your Consent:</strong> When you have given us explicit permission to share your information
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">6. Data Security</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              We implement appropriate technical and organizational security measures to protect your personal
              information, including:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Secure authentication via Clerk with industry-standard protocols</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls limiting employee access to user data</li>
              <li>Secure cloud infrastructure with reputable providers</li>
            </ul>
            <p className="text-zinc-600 dark:text-zinc-300">
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive
              to protect your personal information, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">7. Data Retention</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              We retain your personal information for as long as necessary to:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>Provide you with the Service</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes and enforce agreements</li>
            </ul>
            <p className="text-zinc-600 dark:text-zinc-300">
              Voice data is processed in real-time and is not stored after processing. You may request deletion of your
              account and associated data at any time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">8. Your Rights and Choices</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>
                <strong>Access:</strong> Request a copy of the personal information we hold about you
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate personal information
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your personal information
              </li>
              <li>
                <strong>Portability:</strong> Request a copy of your data in a machine-readable format
              </li>
              <li>
                <strong>Withdraw Consent:</strong> Revoke consent for data processing where applicable
              </li>
              <li>
                <strong>Disconnect Google:</strong> Revoke our access to your Google Calendar at any time through your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline"
                >
                  Google Account settings
                </a>
              </li>
            </ul>
            <p className="text-zinc-600 dark:text-zinc-300">
              To exercise these rights, please contact us at privacy@omnisound.xyz.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">9. Children's Privacy</h2>
            <p className="text-zinc-600 dark:text-zinc-300">
              Our Service is not intended for children under 13 years of age. We do not knowingly collect personal
              information from children under 13. If you are a parent or guardian and believe your child has provided us
              with personal information, please contact us, and we will take steps to delete such information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
              10. International Data Transfers
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300">
              Your information may be transferred to and processed in countries other than your country of residence.
              These countries may have different data protection laws. By using the Service, you consent to such
              transfers. We ensure appropriate safeguards are in place to protect your information in accordance with
              this Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">11. Third-Party Services</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              Our Service uses the following third-party services:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>
                <strong>Clerk:</strong> For authentication and user management
              </li>
              <li>
                <strong>Google:</strong> For OAuth authentication and Calendar integration
              </li>
              <li>
                <strong>Supabase:</strong> For database services
              </li>
              <li>
                <strong>Deepgram:</strong> For voice transcription
              </li>
              <li>
                <strong>OpenAI/AI Providers:</strong> For AI-powered responses
              </li>
              <li>
                <strong>Vercel:</strong> For hosting and analytics
              </li>
            </ul>
            <p className="text-zinc-600 dark:text-zinc-300">
              Each of these services has their own privacy policy governing their use of your data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">12. Changes to This Policy</h2>
            <p className="text-zinc-600 dark:text-zinc-300">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting
              the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this
              Privacy Policy periodically for any changes. Your continued use of the Service after any modifications
              indicates your acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">13. Contact Us</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <ul className="list-none text-zinc-600 dark:text-zinc-300 space-y-2">
              <li>
                <strong>Email:</strong> privacy@omnisound.xyz
              </li>
              <li>
                <strong>Website:</strong> https://earai.vercel.app
              </li>
            </ul>
          </section>

          <section className="border-t border-zinc-200 dark:border-zinc-800 pt-8">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              By using Omnisound, you acknowledge that you have read, understood, and agree to be bound by this Privacy
              Policy.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
