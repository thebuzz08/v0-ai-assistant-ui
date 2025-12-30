import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Terms of Service - Omnisound",
  description: "Terms of Service for Omnisound",
}

export default function TermsOfServicePage() {
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

        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Terms of Service</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-8">
          Last updated: {lastUpdated} | Effective: {effectiveDate}
        </p>

        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              By accessing or using Omnisound ("Service"), operated by Omnisound ("we," "our," or "us"), you agree to be
              bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the
              Service.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300">
              These Terms apply to all visitors, users, and others who access or use the Service. By using the Service,
              you represent that you are at least 13 years old and have the legal capacity to enter into these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">2. Description of Service</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              Omnisound is an AI-powered personal assistant application that provides:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>Voice-based interaction and transcription</li>
              <li>AI-powered responses and assistance</li>
              <li>Google Calendar integration for schedule management</li>
              <li>Note-taking and information organization</li>
              <li>Proactive reminders and suggestions</li>
            </ul>
            <p className="text-zinc-600 dark:text-zinc-300">
              The Service is provided "as is" and may be modified, updated, or discontinued at our discretion.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">3. User Accounts</h2>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">3.1 Account Creation</h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              To use certain features of the Service, you must create an account. You may register using your email
              address or through Google authentication. You agree to provide accurate, current, and complete information
              during registration.
            </p>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">3.2 Account Security</h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities
              that occur under your account. You agree to:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>Use a strong, unique password</li>
              <li>Notify us immediately of any unauthorized access or security breach</li>
              <li>Not share your account credentials with others</li>
              <li>Log out from your account when using shared devices</li>
            </ul>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">3.3 Account Termination</h3>
            <p className="text-zinc-600 dark:text-zinc-300">
              You may delete your account at any time through the Settings page. We reserve the right to suspend or
              terminate your account if you violate these Terms or engage in prohibited conduct.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">4. Acceptable Use</h2>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">4.1 Permitted Uses</h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              You may use the Service only for lawful purposes and in accordance with these Terms. You agree to use the
              Service only for personal, non-commercial purposes unless otherwise agreed in writing.
            </p>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">4.2 Prohibited Conduct</h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">You agree NOT to:</p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Violate any laws, regulations, or third-party rights</li>
              <li>
                Transmit any harmful, offensive, or objectionable content, including hate speech, harassment, or threats
              </li>
              <li>Attempt to gain unauthorized access to the Service, other accounts, or computer systems/networks</li>
              <li>Interfere with or disrupt the Service, servers, or networks connected to the Service</li>
              <li>
                Use any automated means (bots, scrapers, etc.) to access the Service without our express permission
              </li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
              <li>Use the Service to send spam, phishing, or other unsolicited communications</li>
              <li>Circumvent, disable, or otherwise interfere with security features of the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">5. User Content</h2>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">5.1 Your Content</h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              You retain ownership of any content you create, upload, or transmit through the Service ("User Content").
              By using the Service, you grant us a limited license to process, store, and display your User Content
              solely to provide the Service to you.
            </p>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">5.2 Content Responsibility</h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              You are solely responsible for your User Content. You represent and warrant that:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>You own or have the necessary rights to use and authorize use of your User Content</li>
              <li>Your User Content does not violate any third-party rights</li>
              <li>Your User Content complies with these Terms and all applicable laws</li>
            </ul>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">5.3 Voice Data</h3>
            <p className="text-zinc-600 dark:text-zinc-300">
              Voice data submitted to the Service is processed for transcription and AI interaction purposes. Voice data
              is processed in real-time and is not permanently stored after processing.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">6. Third-Party Services</h2>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">6.1 Google Services</h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              The Service integrates with Google services, including Google Sign-In and Google Calendar. Your use of
              Google services is subject to Google's Terms of Service and Privacy Policy. By connecting your Google
              account, you authorize us to access and use your Google data as described in our Privacy Policy.
            </p>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">6.2 AI Services</h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              The Service uses artificial intelligence to provide responses and assistance. AI-generated content:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>May not always be accurate, complete, or up-to-date</li>
              <li>Should not be relied upon as professional, legal, medical, or financial advice</li>
              <li>Is provided for informational purposes only</li>
            </ul>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">6.3 Third-Party Links</h3>
            <p className="text-zinc-600 dark:text-zinc-300">
              The Service may contain links to third-party websites or services. We are not responsible for the content,
              privacy practices, or availability of such third-party services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">7. Intellectual Property</h2>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">7.1 Our Intellectual Property</h3>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              The Service, including its original content, features, functionality, design, and branding, is owned by
              Omnisound and is protected by copyright, trademark, and other intellectual property laws. You may not
              copy, modify, distribute, sell, or lease any part of the Service without our prior written consent.
            </p>

            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">7.2 Feedback</h3>
            <p className="text-zinc-600 dark:text-zinc-300">
              If you provide us with feedback, suggestions, or ideas about the Service, you grant us the right to use
              such feedback without restriction or compensation to you.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">8. Disclaimers</h2>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 mb-4">
              <p className="text-zinc-700 dark:text-zinc-200 mb-4">
                <strong>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.</strong>
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                To the fullest extent permitted by law, we disclaim all warranties, express or implied, including but
                not limited to implied warranties of merchantability, fitness for a particular purpose, and
                non-infringement. We do not warrant that the Service will be uninterrupted, secure, or error-free.
              </p>
            </div>

            <p className="text-zinc-600 dark:text-zinc-300 mb-4">Specifically, we do not guarantee:</p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>The accuracy, reliability, or completeness of AI-generated content</li>
              <li>The accuracy of voice transcriptions</li>
              <li>The availability or uptime of the Service</li>
              <li>That the Service will meet your specific requirements</li>
              <li>The security of data transmitted through the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">9. Limitation of Liability</h2>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 mb-4">
              <p className="text-zinc-700 dark:text-zinc-200">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL OMNISOUND, ITS DIRECTORS, EMPLOYEES, PARTNERS,
                AGENTS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
                PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER
                INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE.
              </p>
            </div>

            <p className="text-zinc-600 dark:text-zinc-300">
              Our total liability to you for any claims arising from or related to the Service shall not exceed the
              amount you paid us, if any, in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">10. Indemnification</h2>
            <p className="text-zinc-600 dark:text-zinc-300">
              You agree to defend, indemnify, and hold harmless Omnisound and its officers, directors, employees,
              agents, and affiliates from and against any claims, damages, obligations, losses, liabilities, costs, or
              expenses (including reasonable attorney's fees) arising from: (a) your use of the Service; (b) your
              violation of these Terms; (c) your violation of any third-party rights; or (d) your User Content.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">11. Changes to Terms</h2>
            <p className="text-zinc-600 dark:text-zinc-300">
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting
              the updated Terms on this page and updating the "Last updated" date. Your continued use of the Service
              after any changes constitutes your acceptance of the new Terms. If you do not agree to the modified Terms,
              you must stop using the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">12. Termination</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              We may terminate or suspend your access to the Service immediately, without prior notice or liability, for
              any reason, including if you breach these Terms. Upon termination:
            </p>
            <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-300 mb-4 space-y-2">
              <li>Your right to use the Service will immediately cease</li>
              <li>We may delete your account and User Content</li>
              <li>
                Provisions of these Terms that by their nature should survive termination shall survive, including
                ownership, disclaimers, indemnification, and limitations of liability
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">13. Governing Law</h2>
            <p className="text-zinc-600 dark:text-zinc-300">
              These Terms shall be governed by and construed in accordance with the laws of the United States, without
              regard to its conflict of law provisions. Any disputes arising from these Terms or your use of the Service
              shall be resolved in the state or federal courts located in the United States.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">14. Severability</h2>
            <p className="text-zinc-600 dark:text-zinc-300">
              If any provision of these Terms is held to be invalid, illegal, or unenforceable, the remaining provisions
              shall continue in full force and effect. The invalid provision shall be modified to the minimum extent
              necessary to make it valid and enforceable while preserving its intent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">15. Entire Agreement</h2>
            <p className="text-zinc-600 dark:text-zinc-300">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Omnisound
              regarding your use of the Service and supersede any prior agreements between you and Omnisound.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">16. Contact Us</h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              If you have any questions about these Terms, please contact us:
            </p>
            <ul className="list-none text-zinc-600 dark:text-zinc-300 space-y-2">
              <li>
                <strong>Email:</strong> legal@omnisound.xyz
              </li>
              <li>
                <strong>Website:</strong> https://earai.vercel.app
              </li>
            </ul>
          </section>

          <section className="border-t border-zinc-200 dark:border-zinc-800 pt-8">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              By using Omnisound, you acknowledge that you have read, understood, and agree to be bound by these Terms
              of Service.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
