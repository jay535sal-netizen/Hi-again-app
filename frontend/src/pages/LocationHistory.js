import { useState, useEffect } from 'react';
import { locationsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';
import { 
    MapPin, Plus, Trash2, Loader2, 
    Calendar, Building, Music, Search 
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../lib/utils';
import TimelineImport from '../components/TimelineImport';
import AutoTrackCTA from '../components/AutoTrackCTA';

export default function LocationHistory() {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Add location form
    const [newLocation, setNewLocation] = useState({
        city: '',
        event_or_place: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
    });
    const [addLoading, setAddLoading] = useState(false);

    useEffect(() => {
        loadLocations();
    }, []);

    const loadLocations = async () => {
        try {
            const response = await locationsApi.getAll();
            setLocations(response.data);
        } catch (error) {
            toast.error('Failed to load locations');
        } finally {
            setLoading(false);
        }
    };

    const handleAddLocation = async (e) => {
        e.preventDefault();
        
        if (!newLocation.city || !newLocation.event_or_place) {
            toast.error('Please enter a city and event/place');
            return;
        }

        setAddLoading(true);
        try {
            await locationsApi.add({
                city: newLocation.city,
                event_or_place: newLocation.event_or_place,
                date: newLocation.date,
                description: newLocation.description || null,
            });
            toast.success('Location added! Checking for matches...');
            setAddDialogOpen(false);
            setNewLocation({ 
                city: '', 
                event_or_place: '', 
                date: new Date().toISOString().split('T')[0],
                description: '' 
            });
            loadLocations();
        } catch (error) {
            const detail = error?.response?.data?.detail || error?.message || 'Failed to add location';
            console.error('Add location failed:', detail);
            toast.error(detail);
        } finally {
            setAddLoading(false);
        }
    };

    const handleDelete = async (locationId) => {
        try {
            await locationsApi.delete(locationId);
            toast.success('Location deleted');
            setLocations(locations.filter((l) => l.id !== locationId));
        } catch (error) {
            toast.error('Failed to delete location');
        }
    };

    const filteredLocations = locations.filter(
        (loc) =>
            loc.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loc.event_or_place?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="locations-page">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="font-heading text-3xl font-light text-white mb-2">
                            Places You've Been
                        </h1>
                        <p className="text-slate-400">
                            {locations.length} location{locations.length !== 1 ? 's' : ''} added
                        </p>
                    </div>

                    {/* Add Location Dialog */}
                    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="btn-primary" data-testid="add-location-btn">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Location
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-white font-heading">
                                    Where were you?
                                </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddLocation} className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">City</Label>
                                    <div className="relative">
                                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <Input
                                            type="text"
                                            value={newLocation.city}
                                            onChange={(e) =>
                                                setNewLocation({ ...newLocation, city: e.target.value })
                                            }
                                            placeholder="New York, Los Angeles, Miami..."
                                            className="input-dark pl-12"
                                            data-testid="location-city"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-slate-300">Event or Place</Label>
                                    <div className="relative">
                                        <Music className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <Input
                                            type="text"
                                            value={newLocation.event_or_place}
                                            onChange={(e) =>
                                                setNewLocation({ ...newLocation, event_or_place: e.target.value })
                                            }
                                            placeholder="Taylor Swift Concert, Coffee Shop, Central Park..."
                                            className="input-dark pl-12"
                                            data-testid="location-event"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-slate-300">Date</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <Input
                                            type="date"
                                            value={newLocation.date}
                                            onChange={(e) =>
                                                setNewLocation({ ...newLocation, date: e.target.value })
                                            }
                                            className="input-dark pl-12"
                                            data-testid="location-date"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-slate-300">Description (optional)</Label>
                                    <Textarea
                                        value={newLocation.description}
                                        onChange={(e) =>
                                            setNewLocation({ ...newLocation, description: e.target.value })
                                        }
                                        placeholder="What were you doing? Who were you with?"
                                        className="bg-slate-950 border-slate-800 focus:border-rose-500 text-white placeholder:text-slate-600 min-h-[80px]"
                                        data-testid="location-description"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={addLoading}
                                    className="w-full btn-primary"
                                    data-testid="submit-location-btn"
                                >
                                    {addLoading ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Plus className="w-4 h-4 mr-2" />
                                    )}
                                    Add Location
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <Input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by city or event..."
                        className="input-dark pl-12"
                        data-testid="search-locations"
                    />
                </div>

                {/* Auto-tracking CTA + manual import */}
                <div className="mb-6 space-y-4">
                    <AutoTrackCTA />
                    <TimelineImport onImported={loadLocations} />
                </div>

                {/* Locations List */}
                {filteredLocations.length > 0 ? (
                    <div className="space-y-4">
                        {filteredLocations.map((location) => (
                            <div
                                key={location.id}
                                className="glass-card p-6 card-hover group"
                                data-testid={`location-${location.id}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                                            <MapPin className="w-6 h-6 text-rose-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-heading font-normal text-white mb-1">
                                                {location.event_or_place}
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Building className="w-4 h-4" />
                                                    {location.city}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4" />
                                                    {formatDate(location.date)}
                                                </span>
                                            </div>
                                            {location.description && (
                                                <p className="text-sm text-slate-500 mt-2">
                                                    {location.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(location.id)}
                                        className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                        data-testid={`delete-location-${location.id}`}
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="glass-card p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                            <MapPin className="w-8 h-8 text-slate-600" />
                        </div>
                        <h3 className="font-heading text-lg font-normal text-white mb-2">
                            {searchTerm ? 'No locations found' : 'No locations yet'}
                        </h3>
                        <p className="text-slate-400 mb-6">
                            {searchTerm
                                ? 'Try a different search term'
                                : 'Add places you\'ve been to discover path crossings!'}
                        </p>
                        {!searchTerm && (
                            <Button
                                onClick={() => setAddDialogOpen(true)}
                                className="btn-primary"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Your First Location
                            </Button>
                        )}
                    </div>
                )}

                {/* Tips */}
                <div className="mt-8 glass-card p-6">
                    <h3 className="font-heading text-lg font-normal text-white mb-4">
                        💡 Tips for Finding Matches
                    </h3>
                    <ul className="space-y-3 text-sm text-slate-400">
                        <li className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                            <span>Add concerts, festivals, and events you've attended</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                            <span>Include popular spots like coffee shops, gyms, or parks</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                            <span>Be specific! "Starbucks on Main St" is better than just "Starbucks"</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                            <span>Share the app with friends to increase your chances of matching!</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
