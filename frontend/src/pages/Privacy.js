import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, MapPin, Lock, Eye, Trash2, Mail } from 'lucide-react';

export default function Privacy() {
    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="privacy-page">
            <div className="max-w-4xl mx-auto px-6">
                <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </Link>

                <div className="glass-card p-8 md:p-12">
                    <div className="flex items-center gap-3 mb-6">
                        <Shield className="w-8 h-8 text-rose-400" />
                        <h1 className="font-heading text-3xl md:text-4xl text-white">Privacy Policy</h1>
                    </div>
                    
                    <p className="text-slate-400 mb-8">Last updated: April 2026</p>

                    <div className="space-y-8 text-slate-300">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <Eye className="w-5 h-5 text-rose-400" />
                                Information We Collect
                            </h2>
                            <p className="mb-3">Hi Again collects the following information to provide our path-crossing discovery service:</p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li><strong>Account Information:</strong> Name, email address, and profile photo (optional)</li>
                                <li><strong>Location Data:</strong> City names, event locations, and GPS coordinates that you choose to share</li>
                                <li><strong>Google Timeline Data:</strong> If you choose to import your Google Timeline, we process this data to find path crossings</li>
                                <li><strong>Usage Data:</strong> How you interact with the app to improve our service</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-rose-400" />
                                How We Use Location Data
                            </h2>
                            <p className="mb-3">Your location data is used exclusively to:</p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Match you with others who were at the same place and time</li>
                                <li>Show you potential connections from past events (concerts, games, etc.)</li>
                                <li>Enable real-time proximity matching when GPS tracking is active</li>
                            </ul>
                            <p className="mt-3 text-rose-300">We never sell your location data to third parties.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <Lock className="w-5 h-5 text-rose-400" />
                                Data Security
                            </h2>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>All data is encrypted in transit using HTTPS/TLS</li>
                                <li>Authentication uses secure httpOnly cookies</li>
                                <li>Passwords are hashed using bcrypt</li>
                                <li>We use cryptographically secure random generation for all tokens</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <Trash2 className="w-5 h-5 text-rose-400" />
                                Your Rights (GDPR/CCPA)
                            </h2>
                            <p className="mb-3">You have the right to:</p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li><strong>Access:</strong> Request a copy of all your personal data</li>
                                <li><strong>Rectification:</strong> Update or correct your information</li>
                                <li><strong>Erasure:</strong> Delete your account and all associated data</li>
                                <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
                                <li><strong>Withdraw Consent:</strong> Stop GPS tracking at any time</li>
                            </ul>
                            <p className="mt-3">To exercise these rights, contact us at <a href="mailto:privacy@hiagain.xyz" className="text-rose-400 hover:underline">privacy@hiagain.xyz</a></p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">Data Retention</h2>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Location history is retained until you delete it or your account</li>
                                <li>GPS pings are automatically deleted after 30 days</li>
                                <li>Account data is deleted within 30 days of account deletion request</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">Third-Party Services</h2>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li><strong>Stripe:</strong> For payment processing (Premium subscriptions and donations)</li>
                                <li><strong>Google:</strong> If you choose to import Google Timeline data</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">Age Requirement</h2>
                            <p>Hi Again is intended for users 18 years of age or older. We do not knowingly collect data from minors.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                <Mail className="w-5 h-5 text-rose-400" />
                                Contact Us
                            </h2>
                            <p>For privacy-related questions or concerns:</p>
                            <p className="mt-2">
                                <a href="mailto:privacy@hiagain.xyz" className="text-rose-400 hover:underline">privacy@hiagain.xyz</a>
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
