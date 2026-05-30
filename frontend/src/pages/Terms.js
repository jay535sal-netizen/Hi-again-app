import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, AlertTriangle, Users, Ban, Scale } from 'lucide-react';

export default function Terms() {
    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="terms-page">
            <div className="max-w-4xl mx-auto px-6">
                <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </Link>

                <div className="glass-card p-8 md:p-12">
                    <div className="flex items-center gap-3 mb-6">
                        <FileText className="w-8 h-8 text-rose-400" />
                        <h1 className="font-heading text-3xl md:text-4xl text-white">Terms of Service</h1>
                    </div>
                    
                    <p className="text-slate-400 mb-8">Last updated: April 2026</p>

                    <div className="space-y-8 text-slate-300">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
                            <p>By creating an account or using Hi Again, you agree to these Terms of Service and our Privacy Policy. If you do not agree, please do not use our service.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
                            <p>Hi Again is a social discovery platform that helps users find people they may have crossed paths with at events, locations, or in daily life. The service uses location data you provide to match you with others who were in the same place at similar times.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <Users className="w-5 h-5 text-rose-400" />
                                3. Eligibility
                            </h2>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>You must be at least 18 years old to use Hi Again</li>
                                <li>You must provide accurate information when creating your account</li>
                                <li>You are responsible for maintaining the security of your account</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">4. User Conduct</h2>
                            <p className="mb-3">You agree NOT to:</p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Use the service for harassment, stalking, or any illegal purpose</li>
                                <li>Impersonate another person or misrepresent your identity</li>
                                <li>Share false location data or manipulate the matching system</li>
                                <li>Spam, scam, or attempt to defraud other users</li>
                                <li>Upload inappropriate, offensive, or illegal content</li>
                                <li>Attempt to access another user's account without permission</li>
                                <li>Use automated tools to scrape data or create fake accounts</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                                5. Safety Guidelines
                            </h2>
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                                <p className="mb-3">When meeting someone from Hi Again in person:</p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li>Always meet in a public place for the first time</li>
                                    <li>Tell a friend or family member about your plans</li>
                                    <li>Trust your instincts - if something feels wrong, leave</li>
                                    <li>Do not share sensitive personal information (home address, financial details) with strangers</li>
                                </ul>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">6. Location Data Consent</h2>
                            <p>By using Hi Again's location features, you consent to:</p>
                            <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
                                <li>Collection of location data you manually enter (cities, events)</li>
                                <li>GPS tracking when you explicitly enable it</li>
                                <li>Processing of Google Timeline data if you choose to import it</li>
                            </ul>
                            <p className="mt-3">You can disable GPS tracking at any time and delete your location history from your profile settings.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">7. Premium Subscription</h2>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Premium subscriptions are billed through Stripe</li>
                                <li>Subscriptions auto-renew unless cancelled before the renewal date</li>
                                <li>Refunds are handled on a case-by-case basis</li>
                                <li>We reserve the right to modify premium features with notice</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">8. Content Ownership</h2>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>You retain ownership of content you post (photos, text)</li>
                                <li>By posting, you grant Hi Again a license to display your content within the app</li>
                                <li>We may remove content that violates these terms</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <Ban className="w-5 h-5 text-rose-400" />
                                9. Account Termination
                            </h2>
                            <p>We may suspend or terminate accounts that:</p>
                            <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
                                <li>Violate these Terms of Service</li>
                                <li>Engage in harassment or illegal activity</li>
                                <li>Create multiple fake accounts</li>
                                <li>Abuse the referral or rewards system</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <Scale className="w-5 h-5 text-rose-400" />
                                10. Limitation of Liability
                            </h2>
                            <p>Hi Again is provided "as is" without warranties. We are not liable for:</p>
                            <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
                                <li>Actions of other users you interact with</li>
                                <li>Accuracy of user-provided location or profile information</li>
                                <li>Service interruptions or data loss</li>
                                <li>Any damages arising from use of the service</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to Terms</h2>
                            <p>We may update these terms from time to time. Continued use after changes constitutes acceptance. We will notify users of material changes via email or in-app notification.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">12. Governing Law</h2>
                            <p>These terms are governed by the laws of the United States. Any disputes will be resolved in the appropriate courts.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">13. Contact</h2>
                            <p>For questions about these terms:</p>
                            <p className="mt-2">
                                <a href="mailto:legal@hiagain.xyz" className="text-rose-400 hover:underline">legal@hiagain.xyz</a>
                            </p>
                            <p className="mt-2 text-slate-400">
                                Crowdspulse Gsphere LLC<br />
                                Hi Again App
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
