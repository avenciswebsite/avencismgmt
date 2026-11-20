import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { policyService } from '../../services/policyService';
import { store } from '../../data/store';
import { WorkLocation } from '../../types';
import { 
  MapPin, 
  Plus, 
  Edit3, 
  Trash2, 
  Compass, 
  Navigation, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ExternalLink,
  Users,
  RefreshCw,
  Sliders
} from 'lucide-react';

export const WorkLocationsView: React.FC = () => {
  const { clientId: routeClientId } = useParams<{ clientId?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { clients, activeClient, activeClientId, refreshWorkspace } = useWorkspace();

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const effectiveClientId = routeClientId || (isSuperAdmin ? 'ALL' : (activeClientId || activeClient?.id));

  const [selectedClientId, setSelectedClientId] = useState<string>(effectiveClientId || 'ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<WorkLocation | null>(null);

  // Form states
  const [formClientId, setFormClientId] = useState<string>(
    selectedClientId !== 'ALL' ? selectedClientId : (clients[0]?.id || '')
  );
  const [formName, setFormName] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formState, setFormState] = useState<string>('Maharashtra');
  const [formLat, setFormLat] = useState<string>('18.5204');
  const [formLng, setFormLng] = useState<string>('73.8567');
  const [formRadius, setFormRadius] = useState<string>('150');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAcquiringGPS, setIsAcquiringGPS] = useState<boolean>(false);

  // Sync client filter when activeClient changes
  useEffect(() => {
    if (!isSuperAdmin && activeClient?.id) {
      setSelectedClientId(activeClient.id);
      setFormClientId(activeClient.id);
    }
  }, [isSuperAdmin, activeClient]);

  // Aggregate locations
  let allLocations: WorkLocation[] = [];
  if (selectedClientId === 'ALL') {
    clients.forEach(c => {
      allLocations = allLocations.concat(store.getLocations(c.id));
    });
  } else {
    allLocations = store.getLocations(selectedClientId);
  }

  const filteredLocations = allLocations.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          loc.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ((loc.state || '').toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // GPS Browser Helper
  const handleAcquireCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFeedback({ type: 'error', message: 'Geolocation is not supported by your browser.' });
      return;
    }
    setIsAcquiringGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLat(pos.coords.latitude.toFixed(6));
        setFormLng(pos.coords.longitude.toFixed(6));
        setIsAcquiringGPS(false);
        setFeedback({ 
          type: 'success', 
          message: `Acquired GPS fix: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} (Accuracy ±${Math.round(pos.coords.accuracy)}m)` 
        });
        setTimeout(() => setFeedback(null), 4000);
      },
      (err) => {
        setIsAcquiringGPS(false);
        setFeedback({ type: 'error', message: `GPS Acquisition failed: ${err.message}` });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleOpenAdd = () => {
    setEditingLocation(null);
    setFormClientId(selectedClientId !== 'ALL' ? selectedClientId : (clients[0]?.id || ''));
    setFormName('');
    setFormAddress('');
    setFormState('Maharashtra');
    setFormLat('18.5204');
    setFormLng('73.8567');
    setFormRadius('150');
    setShowAddModal(true);
  };

  const handleOpenEdit = (loc: WorkLocation) => {
    setEditingLocation(loc);
    setFormClientId(loc.clientId);
    setFormName(loc.name);
    setFormAddress(loc.address);
    setFormState(loc.state || 'Maharashtra');
    setFormLat(loc.latitude.toString());
    setFormLng(loc.longitude.toString());
    setFormRadius((loc.radiusMeters || 150).toString());
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAddress.trim()) {
      setFeedback({ type: 'error', message: 'Worksite name and address are required.' });
      return;
    }

    const lat = parseFloat(formLat);
    const lng = parseFloat(formLng);
    const radius = parseInt(formRadius, 10);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setFeedback({ type: 'error', message: 'Latitude must be between -90 and 90 degrees.' });
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setFeedback({ type: 'error', message: 'Longitude must be between -180 and 180 degrees.' });
      return;
    }
    if (isNaN(radius) || radius < 20 || radius > 5000) {
      setFeedback({ type: 'error', message: 'Geofence radius must be between 20 and 5,000 meters.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (editingLocation) {
        // Update existing site
        const res = await policyService.updateWorkLocation(editingLocation.id, {
          name: formName.trim(),
          address: formAddress.trim(),
          state: formState,
          latitude: lat,
          longitude: lng,
          radius_meters: radius,
        });

        if (!res.success) {
          throw new Error(res.error?.message || 'Failed to update work location.');
        }

        setFeedback({ type: 'success', message: `Successfully updated worksite "${formName}" and geofence telemetry.` });
      } else {
        // Create new worksite
        const res = await policyService.createWorkLocation({
          client_id: formClientId,
          name: formName.trim(),
          address: formAddress.trim(),
          state: formState,
          latitude: lat,
          longitude: lng,
          radius_meters: radius,
        });

        if (!res.success) {
          throw new Error(res.error?.message || 'Failed to create work location.');
        }

        setFeedback({ type: 'success', message: `Registered new work site "${formName}" with ${radius}m geofence radius.` });
      }

      refreshWorkspace();
      setShowAddModal(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Operation failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (loc: WorkLocation) => {
    if (!window.confirm(`Are you sure you want to remove work location "${loc.name}"? Employees assigned to this site will need to be reallocated.`)) {
      return;
    }

    try {
      const res = await policyService.deleteWorkLocation(loc.id);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to delete work location.');
      }
      setFeedback({ type: 'success', message: `Work location "${loc.name}" was successfully removed.` });
      refreshWorkspace();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Deletion failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-primary-container text-primary text-xs font-semibold uppercase tracking-wider">
              Operational Telemetry • Geofence Boundaries
            </span>
            <span className="text-on-surface-variant text-xs">•</span>
            <span className="text-on-surface-variant text-xs">
              {filteredLocations.length} Active Sites
            </span>
          </div>
          <h1 className="font-serif text-3xl text-primary font-normal">
            Work Locations & Geofencing Management
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Configure authorized workplace physical locations, GPS coordinate perimeters, and biometric punch validation radii.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded font-medium text-sm hover:bg-primary/90 shadow transition-all shrink-0"
        >
          <Plus className="w-4 h-4 text-secondary-fixed" />
          <span>Add New Work Site</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-outline" />
          <input
            type="text"
            placeholder="Search by worksite name, address, or state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface focus:outline-none"
          />
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
            <span className="text-on-surface-variant font-medium">Filter Client:</span>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="p-1.5 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface text-xs focus:outline-none"
            >
              <option value="ALL">All Clients ({clients.length})</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Locations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLocations.map((loc) => {
          const client = clients.find(c => c.id === loc.clientId);
          const mapsUrl = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;

          return (
            <div
              key={loc.id}
              className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4 hover:border-outline-variant/60 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                      {loc.state || 'Maharashtra'}
                    </span>
                    <h3 className="font-serif text-lg text-primary font-normal mt-2">
                      {loc.name}
                    </h3>
                    <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                      Client: <strong>{client?.name || 'Assigned Organisation'}</strong>
                    </p>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0 border border-primary/10">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                </div>

                <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20 mt-4 space-y-2 text-xs">
                  <div className="text-on-surface-variant flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-outline mt-0.5 shrink-0" />
                    <span>{loc.address}</span>
                  </div>

                  <div className="pt-2 border-t border-outline-variant/20 grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-on-surface-variant block text-[10px] uppercase">Latitude</span>
                      <span className="font-semibold text-primary">{loc.latitude}° N</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[10px] uppercase">Longitude</span>
                      <span className="font-semibold text-primary">{loc.longitude}° E</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px]">
                    <span className="text-on-surface-variant font-medium">Geofence Radius:</span>
                    <span className="font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                      {loc.radiusMeters || 150} meters
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-on-surface-variant font-medium">Assigned Staff:</span>
                    <span className="font-bold text-on-surface flex items-center gap-1">
                      <Users className="w-3 h-3 text-secondary" />
                      <span>{loc.activeHeadcount || 0} employees</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20 text-xs">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors font-medium text-[11px]"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-secondary" />
                  <span>Google Maps</span>
                </a>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(loc)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant hover:bg-surface-container font-semibold text-on-surface transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-secondary" />
                    <span>Edit Geofence</span>
                  </button>
                  <button
                    onClick={() => handleDelete(loc)}
                    className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors"
                    title="Delete Work Site"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredLocations.length === 0 && (
        <div className="p-12 text-center bg-surface-container-lowest rounded-xl border border-outline-variant/30 space-y-3">
          <MapPin className="w-8 h-8 text-outline mx-auto" />
          <h3 className="font-serif text-lg text-primary">No Work Locations Found</h3>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            No physical sites match your search filter. Register your organization's physical operating locations to enable mobile GPS check-in.
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded font-medium text-xs hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Work Site Now</span>
          </button>
        </div>
      )}

      {/* Add / Edit Working Site Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-primary-dark/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 max-w-lg w-full p-6 shadow-elevated space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-outline-variant/20">
              <div>
                <span className="text-[10px] uppercase font-bold text-accent tracking-wider font-sans">
                  {editingLocation ? 'Modify Worksite & Geofence' : 'Register New Working Site'}
                </span>
                <h2 className="font-serif text-xl text-primary font-bold mt-0.5">
                  {editingLocation ? `Edit ${editingLocation.name}` : 'Add Working Site / Geolocation'}
                </h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-on-surface-variant hover:text-on-surface text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Organization Client */}
              {isSuperAdmin && !editingLocation && (
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">
                    Client Organisation <span className="text-error">*</span>
                  </label>
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="w-full p-2.5 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface font-semibold"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-on-surface-variant font-medium mb-1">
                  Site / Facility Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pune Central Depot, Bandra Corporate Headquarters"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full p-2.5 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface"
                />
              </div>

              <div>
                <label className="block text-on-surface-variant font-medium mb-1">
                  Full Postal Address <span className="text-error">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Plot 42, Hadapsar Industrial Estate, Pune, Maharashtra 411028"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  required
                  className="w-full p-2.5 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface resize-none"
                />
              </div>

              <div>
                <label className="block text-on-surface-variant font-medium mb-1">
                  State / Jurisdiction <span className="text-error">*</span>
                </label>
                <select
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  className="w-full p-2.5 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface font-medium"
                >
                  <option value="Maharashtra">Maharashtra (PT Enforced)</option>
                  <option value="Karnataka">Karnataka (PT Enforced)</option>
                  <option value="Delhi">Delhi (NCR Territory)</option>
                  <option value="Telangana">Telangana (PT Enforced)</option>
                  <option value="Tamil Nadu">Tamil Nadu (PT Enforced)</option>
                  <option value="Gujarat">Gujarat (PT Enforced)</option>
                </select>
              </div>

              {/* Coordinates & Geofencing Card */}
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/15 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-accent" />
                    <span>GPS Telemetry Coordinates</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAcquireCurrentLocation}
                    disabled={isAcquiringGPS}
                    className="flex items-center gap-1 text-[11px] font-bold text-accent hover:text-accent-hover transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{isAcquiringGPS ? 'Acquiring...' : 'Use My GPS Location'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-on-surface-variant font-mono text-[10px] mb-1">Latitude (° N)</label>
                    <input
                      type="number"
                      step="any"
                      value={formLat}
                      onChange={(e) => setFormLat(e.target.value)}
                      required
                      className="w-full p-2 bg-surface-container-lowest rounded border border-outline-variant/30 text-on-surface font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-on-surface-variant font-mono text-[10px] mb-1">Longitude (° E)</label>
                    <input
                      type="number"
                      step="any"
                      value={formLng}
                      onChange={(e) => setFormLng(e.target.value)}
                      required
                      className="w-full p-2 bg-surface-container-lowest rounded border border-outline-variant/30 text-on-surface font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-on-surface-variant font-medium">Geofence Radius (meters)</label>
                    <span className="font-bold text-primary font-mono">{formRadius}m</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="1000"
                    step="10"
                    value={formRadius}
                    onChange={(e) => setFormRadius(e.target.value)}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant mt-1 font-mono">
                    <span>20m (Strict Room)</span>
                    <span>150m (Standard Facility)</span>
                    <span>500m (Campus)</span>
                    <span>1000m (Zone)</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded hover:text-on-surface font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary text-white rounded font-semibold hover:bg-primary/90 transition-colors shadow flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingLocation ? 'Save Geofence Changes' : 'Register Work Site'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
