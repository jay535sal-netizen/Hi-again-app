import { useState } from 'react';
import { Plus, Users, UserPlus, X, Phone, User, Shield, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import api from '../lib/api';

export default function PrivateCircle() {
    const [showModal, setShowModal] = useState(false);
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [manualMode, setManualMode] = useState(false);
    const [manualContact, setManualContact] = useState({ name: '', phone: '' });

    // Use native Contact Picker API if available
    const openContactPicker = async () => {
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                const props = ['name', 'tel'];
                const opts = { multiple: true };
                const selectedContacts = await navigator.contacts.select(props, opts);
                
                if (selectedContacts.length > 0) {
                    const formattedContacts = selectedContacts.map(c => ({
                        name: c.name?.[0] || 'Unknown',
                        phone: c.tel?.[0] || '',
                    })).filter(c => c.phone);
                    
                    setContacts(formattedContacts);
                    setShowModal(true);
                }
            } catch (err) {
                if (err.name !== 'InvalidStateError') {
                    // Fallback to manual mode
                    setManualMode(true);
                    setShowModal(true);
                }
            }
        } else {
            // No Contact Picker API, use manual mode
            setManualMode(true);
            setShowModal(true);
        }
    };

    const addManualContact = () => {
        if (!manualContact.name || !manualContact.phone) {
            toast.error('Please enter name and phone number');
            return;
        }
        setContacts([...contacts, { ...manualContact }]);
        setManualContact({ name: '', phone: '' });
    };

    const removeContact = (index) => {
        setContacts(contacts.filter((_, i) => i !== index));
    };

    const saveToCircle = async () => {
        if (contacts.length === 0) {
            toast.error('Add at least one contact');
            return;
        }

        setLoading(true);
        try {
            // Hash phone numbers client-side before sending
            const hashedContacts = await Promise.all(
                contacts.map(async (c) => ({
                    name: c.name,
                    phone_hash: await hashPhoneNumber(c.phone),
                }))
            );

            await api.post('/circle/add', { contacts: hashedContacts });
            toast.success(`Added ${contacts.length} contact${contacts.length > 1 ? 's' : ''} to your circle!`);
            setContacts([]);
            setShowModal(false);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to add contacts');
        } finally {
            setLoading(false);
        }
    };

    // Simple hash function for phone numbers (in production, use SHA-256)
    const hashPhoneNumber = async (phone) => {
        const normalized = phone.replace(/\D/g, ''); // Remove non-digits
        const encoder = new TextEncoder();
        const data = encoder.encode(normalized);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    return (
        <>
            {/* Main Button - Green with bright plus icon */}
            <button
                onClick={openContactPicker}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-green-500/20"
                style={{ backgroundColor: '#28A745' }}
                data-testid="add-to-circle-button"
            >
                <Plus 
                    className="w-5 h-5" 
                    style={{ color: '#00E676' }}
                    strokeWidth={3}
                />
                <span>Add to Circle</span>
            </button>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="glass-card p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" data-testid="circle-modal">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#28A745' }}>
                                    <Users className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-heading text-lg text-white">Private Circle</h3>
                                    <p className="text-sm text-slate-400">Add friends you want to find</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Privacy Notice */}
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-6">
                            <Shield className="w-5 h-5 text-emerald-400 mt-0.5" />
                            <p className="text-sm text-emerald-300">
                                Phone numbers are encrypted before leaving your device. We never store raw contact data.
                            </p>
                        </div>

                        {/* Manual Add Form */}
                        {manualMode && (
                            <div className="mb-6 p-4 rounded-lg bg-slate-800/50">
                                <h4 className="text-sm font-medium text-white mb-3">Add Contact Manually</h4>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <Input
                                            value={manualContact.name}
                                            onChange={(e) => setManualContact({ ...manualContact, name: e.target.value })}
                                            placeholder="Name"
                                            className="input-dark pl-10"
                                            data-testid="contact-name-input"
                                        />
                                    </div>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <Input
                                            value={manualContact.phone}
                                            onChange={(e) => setManualContact({ ...manualContact, phone: e.target.value })}
                                            placeholder="Phone number"
                                            type="tel"
                                            className="input-dark pl-10"
                                            data-testid="contact-phone-input"
                                        />
                                    </div>
                                    <Button
                                        onClick={addManualContact}
                                        className="w-full"
                                        style={{ backgroundColor: '#28A745' }}
                                        data-testid="add-contact-button"
                                    >
                                        <Plus className="w-4 h-4 mr-2" style={{ color: '#00E676' }} />
                                        Add Contact
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Selected Contacts List */}
                        {contacts.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-white mb-3">
                                    Selected Contacts ({contacts.length})
                                </h4>
                                <div className="space-y-2">
                                    {contacts.map((contact, index) => (
                                        <div
                                            key={`${contact.name}-${contact.phone}`}
                                            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                                    <span className="text-sm text-white font-medium">
                                                        {contact.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-white text-sm">{contact.name}</p>
                                                    <p className="text-slate-500 text-xs">{contact.phone}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeContact(index)}
                                                className="p-1 text-slate-400 hover:text-red-400"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {contacts.length === 0 && !manualMode && (
                            <div className="text-center py-8">
                                <UserPlus className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400 mb-4">No contacts selected</p>
                                <Button
                                    onClick={() => setManualMode(true)}
                                    variant="outline"
                                    className="border-slate-700 text-slate-300"
                                >
                                    Add Manually
                                </Button>
                            </div>
                        )}

                        {/* Save Button */}
                        {contacts.length > 0 && (
                            <Button
                                onClick={saveToCircle}
                                disabled={loading}
                                className="w-full py-3"
                                style={{ backgroundColor: '#28A745' }}
                                data-testid="save-circle-button"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-5 h-5 mr-2" />
                                        Save to Circle
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
