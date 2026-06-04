import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DeleteAccount() {
    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="delete-account-page">
            <div className="max-w-4xl mx-auto px-6">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
                    data-testid="delete-account-back-link"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </Link>

                <div className="glass-card p-8 md:p-12">
                    <div className="flex items-center gap-3 mb-6">
                        <Trash2 className="w-8 h-8 text-rose-400" />
                        <h1 className="font-heading text-3xl md:text-4xl text-white">
                            Delete Your Hi Again Account
                        </h1>
                    </div>

                    <p className="text-slate-400 mb-8">
                        Developer: Crowdspulse Gsphere LLC &nbsp;·&nbsp; App: Hi Again &nbsp;·&nbsp;
                        Last updated: February 2026
                    </p>

                    <div className="space-y-8 text-slate-300">
                        <section>
                            <p className="text-lg leading-relaxed">
                                You can permanently delete your Hi Again account and all associated data at
                                any time. This page explains exactly how. Account deletion is irreversible.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-rose-400" />
                                Option 1: Delete from inside the app (recommended)
                            </h2>
                            <ol className="list-decimal list-inside space-y-2 ml-2">
                                <li>Open the Hi Again app and sign in.</li>
                                <li>Tap your profile picture (top right) to open <strong>Settings</strong>.</li>
                                <li>Scroll to the bottom and tap <strong>Delete Account</strong>.</li>
                                <li>Confirm by typing <code className="px-2 py-0.5 bg-slate-800 rounded">DELETE</code> and tapping the red button.</li>
                                <li>Your account, profile, posts, locations, and crossings are removed within minutes.</li>
                            </ol>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <Mail className="w-5 h-5 text-rose-400" />
                                Option 2: Email request (if you can't access the app)
                            </h2>
                            <p className="mb-3">
                                Email{' '}
                                <a
                                    href="mailto:hello@hiagain.xyz?subject=Account%20Deletion%20Request"
                                    className="text-rose-400 underline hover:text-rose-300"
                                    data-testid="delete-account-email-link"
                                >
                                    hello@hiagain.xyz
                                </a>{' '}
                                from the email address tied to your account with the subject line{' '}
                                <strong>"Account Deletion Request"</strong>.
                            </p>
                            <p>
                                We verify ownership and complete the deletion within{' '}
                                <strong>7 business days</strong>. You'll receive a confirmation email once
                                it's done.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">
                                What gets deleted
                            </h2>
                            <ul className="list-disc list-inside space-y-2 ml-2">
                                <li>Your profile (name, bio, photos, email, password)</li>
                                <li>All location history and timeline data</li>
                                <li>Posts, comments, likes, and missed-connection entries you authored</li>
                                <li>Crossings, matches, and Private Circle relationships</li>
                                <li>Gatherings you created or RSVP'd to</li>
                                <li>FCM push notification tokens</li>
                                <li>Stripe customer record (subscription is canceled first if active)</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">
                                What we may retain (and why)
                            </h2>
                            <ul className="list-disc list-inside space-y-2 ml-2">
                                <li>
                                    <strong>Payment records</strong>: kept for up to 7 years to comply with
                                    US/EU tax and accounting law. These contain transaction amount and
                                    date only — no personal profile data.
                                </li>
                                <li>
                                    <strong>Abuse / safety logs</strong>: if your account was reported or
                                    banned for policy violations, a hashed identifier is retained to
                                    prevent re-registration. No personal content is kept.
                                </li>
                                <li>
                                    <strong>Anonymized analytics</strong>: aggregate, non-identifiable
                                    counters (e.g., "5,432 crossings created in March") have no link back
                                    to your account.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                                Deletion is permanent
                            </h2>
                            <p>
                                Once your account is deleted, it cannot be restored. If you want to come
                                back later, you'll have to sign up again with a new account. If you'd
                                rather take a break instead, try <strong>Ghost Mode</strong> (Settings →
                                Ghost Mode) — it hides you from all matching while keeping your data
                                intact.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">Questions?</h2>
                            <p>
                                Contact us at{' '}
                                <a
                                    href="mailto:hello@hiagain.xyz"
                                    className="text-rose-400 underline hover:text-rose-300"
                                >
                                    hello@hiagain.xyz
                                </a>
                                . We respond within 48 hours on business days.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
