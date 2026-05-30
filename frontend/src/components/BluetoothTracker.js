import { useState, useEffect, useCallback, useRef } from 'react';
import { gpsApi } from '../lib/api';
import { Button } from './ui/button';
import { 
    Bluetooth, BluetoothOff, Loader2, Users, Radio,
    AlertCircle, CheckCircle, Waves, Smartphone
} from 'lucide-react';
import { toast } from 'sonner';

// Hi Again BLE Service UUID - unique identifier for our app
const HIAGAIN_SERVICE_UUID = 'f7826da6-4fa2-4e98-8024-bc5b71e0893e';
const HIAGAIN_CHAR_UUID = 'f7826da6-4fa2-4e98-8024-bc5b71e0893f';

// Dynamic import for BLE client (only works in Capacitor)
let BleClient = null;
let ScanMode = null;

// Try to import Capacitor BLE plugin
const loadBleModule = async () => {
    try {
        const module = await import('@anthropic-community/bluetooth-le');
        BleClient = module.BleClient;
        ScanMode = module.ScanMode;
        return true;
    } catch {
        // BLE module not available (web browser)
        return false;
    }
};

export default function BluetoothTracker({ userId, onEncounterFound, compact = false }) {
    const [bleAvailable, setBleAvailable] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [advertising, setAdvertising] = useState(false);
    const [nearbyDevices, setNearbyDevices] = useState([]);
    const [encounters, setEncounters] = useState(0);
    const [error, setError] = useState(null);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const scanIntervalRef = useRef(null);
    const encounteredDevicesRef = useRef(new Set());

    // Check BLE availability on mount
    useEffect(() => {
        const init = async () => {
            await loadBleModule();
            checkBleAvailability();
        };
        init();
        return () => {
            stopScanning();
        };
    }, []);

    const checkBleAvailability = async () => {
        try {
            // Check if running in Capacitor (native) or browser
            const isNative = window.Capacitor?.isNativePlatform();
            
            if (!isNative) {
                // Web fallback - check Web Bluetooth API
                if ('bluetooth' in navigator) {
                    setBleAvailable(true);
                    setPermissionGranted(true);
                } else {
                    setError('Bluetooth available in mobile app only');
                    setBleAvailable(false);
                }
                return;
            }

            if (!BleClient) {
                setError('Bluetooth module not loaded');
                setBleAvailable(false);
                return;
            }

            // Native Capacitor - initialize BLE
            await BleClient.initialize();
            const enabled = await BleClient.isEnabled();
            setBleAvailable(enabled);
            
            if (!enabled) {
                setError('Please enable Bluetooth on your device');
            } else {
                setPermissionGranted(true);
            }
        } catch (err) {
            console.error('BLE check failed:', err);
            setError('Bluetooth not available');
            setBleAvailable(false);
        }
    };

    const requestPermissions = async () => {
        try {
            const isNative = window.Capacitor?.isNativePlatform();
            
            if (isNative) {
                // Request Bluetooth permissions on Android
                await BleClient.requestLEScan({
                    services: [HIAGAIN_SERVICE_UUID],
                }, () => {});
                await BleClient.stopLEScan();
            }
            
            setPermissionGranted(true);
            toast.success('Bluetooth permissions granted');
        } catch (err) {
            console.error('Permission request failed:', err);
            setError('Bluetooth permission denied');
            toast.error('Please allow Bluetooth access');
        }
    };

    const startScanning = useCallback(async () => {
        if (!bleAvailable || scanning) return;

        setScanning(true);
        setError(null);

        try {
            const isNative = window.Capacitor?.isNativePlatform();

            if (isNative) {
                // Native BLE scanning
                await BleClient.requestLEScan(
                    {
                        services: [HIAGAIN_SERVICE_UUID],
                        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
                    },
                    (result) => {
                        handleDeviceFound(result);
                    }
                );

                // Also start advertising our presence
                startAdvertising();
            } else {
                // Web Bluetooth fallback (limited functionality)
                toast.info('Web Bluetooth has limited range. For best results, use the mobile app.');
            }

            toast.success('Bluetooth scanning started');
        } catch (err) {
            console.error('Scan start failed:', err);
            setError('Failed to start Bluetooth scan');
            setScanning(false);
            toast.error('Bluetooth scan failed');
        }
    }, [bleAvailable, scanning]);

    const stopScanning = useCallback(async () => {
        try {
            const isNative = window.Capacitor?.isNativePlatform();
            
            if (isNative) {
                await BleClient.stopLEScan();
            }
            
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
                scanIntervalRef.current = null;
            }
            
            setScanning(false);
            setAdvertising(false);
            toast.info('Bluetooth scanning stopped');
        } catch (err) {
            console.error('Stop scan failed:', err);
        }
    }, []);

    const startAdvertising = async () => {
        // Note: BLE advertising requires native code
        // This would broadcast our user ID to nearby devices
        setAdvertising(true);
    };

    const handleDeviceFound = async (result) => {
        const deviceId = result.device.deviceId;
        
        // Skip if already encountered this device in this session
        if (encounteredDevicesRef.current.has(deviceId)) {
            return;
        }

        // Extract user ID from advertisement data if available
        const advertisementUserId = extractUserIdFromAdvertisement(result);
        
        if (advertisementUserId && advertisementUserId !== userId) {
            encounteredDevicesRef.current.add(deviceId);
            
            // Record the BLE encounter
            try {
                await recordBleEncounter(advertisementUserId, result.rssi);
                
                setEncounters(prev => prev + 1);
                setNearbyDevices(prev => [...prev, {
                    deviceId,
                    userId: advertisementUserId,
                    rssi: result.rssi,
                    distance: estimateDistance(result.rssi),
                    timestamp: new Date().toISOString()
                }]);
                
                toast.success('Nearby Hi Again user detected!');
                onEncounterFound?.(1);
            } catch (err) {
                console.error('Failed to record encounter:', err);
            }
        }
    };

    const extractUserIdFromAdvertisement = (result) => {
        // Extract user ID from the BLE advertisement service data
        // This would be encoded in the advertisement packet
        try {
            const serviceData = result.serviceData?.[HIAGAIN_SERVICE_UUID];
            if (serviceData) {
                // Decode user ID from service data
                const decoder = new TextDecoder();
                return decoder.decode(serviceData);
            }
        } catch {
            // Could not extract user ID
        }
        return null;
    };

    const estimateDistance = (rssi) => {
        // Estimate distance from RSSI (signal strength)
        // This is approximate - RSSI varies by device and environment
        const txPower = -59; // Calibrated transmission power at 1 meter
        if (rssi === 0) return -1;
        
        const ratio = rssi / txPower;
        if (ratio < 1.0) {
            return Math.pow(ratio, 10);
        }
        return (0.89976 * Math.pow(ratio, 7.7095) + 0.111);
    };

    const getProximityLevel = (distance) => {
        if (distance < 2) return { level: 'immediate', label: 'Very Close', color: 'text-green-400' };
        if (distance < 10) return { level: 'near', label: 'Nearby', color: 'text-amber-400' };
        if (distance < 30) return { level: 'far', label: 'In Range', color: 'text-blue-400' };
        return { level: 'unknown', label: 'Detected', color: 'text-slate-400' };
    };

    const recordBleEncounter = async (otherUserId, rssi) => {
        try {
            await gpsApi.recordBleEncounter(otherUserId, rssi);
        } catch (err) {
            console.error('Failed to record BLE encounter:', err);
        }
    };

    // Compact view for dashboard
    if (compact) {
        return (
            <div className="glass-card p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${scanning ? 'bg-blue-500/20' : 'bg-slate-700/50'}`}>
                            {scanning ? (
                                <Bluetooth className="w-5 h-5 text-blue-400 animate-pulse" />
                            ) : (
                                <BluetoothOff className="w-5 h-5 text-slate-400" />
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">Bluetooth Discovery</p>
                            <p className="text-xs text-slate-400">
                                {scanning ? `${nearbyDevices.length} nearby` : 'Tap to scan'}
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant={scanning ? "destructive" : "default"}
                        onClick={scanning ? stopScanning : startScanning}
                        disabled={!bleAvailable}
                        className={scanning ? '' : 'bg-blue-600 hover:bg-blue-700'}
                    >
                        {scanning ? 'Stop' : 'Scan'}
                    </Button>
                </div>
            </div>
        );
    }

    // Full view
    return (
        <div className="glass-card p-6" data-testid="bluetooth-tracker">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${scanning ? 'bg-blue-500/20 animate-pulse' : 'bg-slate-700/50'}`}>
                        <Bluetooth className={`w-6 h-6 ${scanning ? 'text-blue-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">Bluetooth Discovery</h3>
                        <p className="text-sm text-slate-400">
                            {scanning ? 'Scanning for nearby users...' : 'Find Hi Again users around you'}
                        </p>
                    </div>
                </div>
                
                {/* Status indicator */}
                <div className="flex items-center gap-2">
                    {bleAvailable ? (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            BLE Ready
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                            <AlertCircle className="w-3 h-3" />
                            BLE Unavailable
                        </span>
                    )}
                </div>
            </div>

            {/* Error display */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </p>
                </div>
            )}

            {/* Permission request */}
            {bleAvailable && !permissionGranted && (
                <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-300 mb-3">
                        Bluetooth permission required for proximity detection
                    </p>
                    <Button onClick={requestPermissions} className="bg-amber-600 hover:bg-amber-700">
                        Grant Permission
                    </Button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-400">{encounters}</p>
                    <p className="text-xs text-slate-400">Encounters</p>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-400">{nearbyDevices.length}</p>
                    <p className="text-xs text-slate-400">Nearby Now</p>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                    <div className={`text-2xl font-bold ${scanning ? 'text-amber-400' : 'text-slate-500'}`}>
                        {scanning ? <Waves className="w-6 h-6 mx-auto animate-pulse" /> : '—'}
                    </div>
                    <p className="text-xs text-slate-400">{scanning ? 'Scanning' : 'Idle'}</p>
                </div>
            </div>

            {/* Control button */}
            <Button
                onClick={scanning ? stopScanning : startScanning}
                disabled={!bleAvailable || !permissionGranted}
                className={`w-full py-6 text-lg ${
                    scanning 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                }`}
            >
                {scanning ? (
                    <>
                        <Radio className="w-5 h-5 mr-2 animate-pulse" />
                        Stop Scanning
                    </>
                ) : (
                    <>
                        <Bluetooth className="w-5 h-5 mr-2" />
                        Start Bluetooth Scan
                    </>
                )}
            </Button>

            {/* Nearby devices list */}
            {nearbyDevices.length > 0 && (
                <div className="mt-6">
                    <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Nearby Hi Again Users
                    </h4>
                    <div className="space-y-2">
                        {nearbyDevices.slice(-5).reverse().map((device, index) => {
                            const proximity = getProximityLevel(device.distance);
                            return (
                                <div 
                                    key={device.deviceId + index}
                                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <Smartphone className="w-5 h-5 text-slate-400" />
                                        <div>
                                            <p className="text-sm text-white">Hi Again User</p>
                                            <p className={`text-xs ${proximity.color}`}>
                                                {proximity.label} (~{device.distance.toFixed(1)}m)
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500">
                                            {new Date(device.timestamp).toLocaleTimeString()}
                                        </p>
                                        <p className="text-xs text-slate-600">
                                            RSSI: {device.rssi}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Info text */}
            <p className="mt-4 text-xs text-slate-500 text-center">
                Bluetooth scanning detects other Hi Again users within ~30 meters.
                Both users must have the app open for detection.
            </p>
        </div>
    );
}
