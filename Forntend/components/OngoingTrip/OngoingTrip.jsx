import React, { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import Header from "./Header/Header";
import RouteMap from "../Map/RouteMap";
import LocationBar from "./LocationBar/LocationBar";
import OngoingTripDetails from "./OngoingTripDetails/OngoingTripDetails";
import ETA from "./ETA/ETA";
import Distance from "./Distance/Distance";
import WebSocketController from "../../controllers/websocket/ConnectionManger";
import { useLocation } from "../Geolocation/Geolocation";
import { apiFetch } from "../../controllers/apiClient";
const OngoingTrip = () => {
  const [etaMinutes, setEtaMinutes] = useState(12);
  const [distanceKm, setDistanceKm] = useState(5.2);
  const [progress, setProgress] = useState(15);
  const [driverLocation, setDriverLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const ongoingTrip = useSelector((state) => state.ongoingTripDetails);
  const nearbyDrivers = useSelector((state) => state.nearbyDrivers);

  // Get real-time location updates
  const {
    coordinates: currentLocation,
    error: locationError,
    loading: locationLoading,
  } = useLocation({
    trackPeriodically: true,
    isActive: true,
    id: user.id,
    onLocationUpdate: (coords) => {
      console.log("📍 Real-time location update:", coords);
      setLastUpdate(new Date());
    },
  });

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Calculate ETA based on distance and average speed
  const calculateETA = useCallback((distance, speed = 30) => {
    return (distance / speed) * 60; // Convert to minutes
  }, []);

  // Get trip details from Redux
  console.log("🔍 OngoingTrip - ongoingTrip from Redux:", ongoingTrip);
  console.log("🔍 OngoingTrip - user from Redux:", user);
  console.log("🔍 OngoingTrip - current location:", currentLocation);

  const tripDetails = ongoingTrip || {
    pickup_location: "123 Main Street",
    destination: "456 Broadway",
    driver_name: "Alex Miller",
    fare: 250,
  };

  console.log("🔍 OngoingTrip - final tripDetails:", tripDetails);

  // Function to fetch driver location from database
  const fetchDriverLocationFromDB = async (driverId) => {
    try {
      console.log(
        `🗄️ Fetching driver location from database for driver: ${driverId}`
      );

      const response = await apiFetch(`/driver-location/${driverId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Driver location fetched from API:`, data);
        return data;
      } else {
        const errorText = await response.text();
        console.log(`❌ Failed to fetch driver location: ${response.status}`);
        console.log(`❌ Error response:`, errorText);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error fetching driver location:`, error);
      return null;
    }
  };

  // Real-time driver location update function
  const updateDriverLocationRealtime = async (driverId) => {
    try {
      console.log(`🔄 Fetching current location for driver: ${driverId}`);
      const locationData = await fetchDriverLocationFromDB(driverId);

      if (locationData && locationData.latitude && locationData.longitude) {
        const newLocation = {
          id: driverId,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          timestamp: locationData.updated_at || new Date().toISOString(),
          name: `Driver ${driverId}`,
          status: "available",
          realtime: true,
        };

        setDriverLocation(newLocation);
        setLastUpdate(new Date());

        console.log(`✅ Current driver location:`, {
          driver: driverId,
          lat: locationData.latitude,
          lng: locationData.longitude,
          timestamp: newLocation.timestamp,
        });
        return newLocation;
      } else {
        console.log(`⚠️ No location data found for driver: ${driverId}`);
      }
    } catch (error) {
      console.error(`❌ Error fetching driver location:`, error);
    }
    return null;
  };

  // Get driver's current location from nearby drivers or database
  useEffect(() => {
    if (ongoingTrip && ongoingTrip.driver_id) {
      const driverId = ongoingTrip.driver_id;
      console.log(`🔍 Looking for driver location for driver ID: ${driverId}`);

      // First check nearby drivers
      if (nearbyDrivers && nearbyDrivers.drivers) {
        const driver = Object.values(nearbyDrivers.drivers).find(
          (d) => d.id === driverId || d.driver_id === driverId
        );

        if (driver && driver.latitude && driver.longitude) {
          const newDriverLocation = {
            latitude: driver.latitude,
            longitude: driver.longitude,
            timestamp: driver.timestamp,
            name: driver.name,
            realtime: true,
          };
          setDriverLocation(newDriverLocation);
          console.log(
            `✅ Driver location found in nearby drivers:`,
            newDriverLocation
          );
          return;
        }
      }

      // If not found in nearby drivers, fetch from database
      console.log(
        `🔍 Driver not found in nearby drivers, fetching from database...`
      );
      updateDriverLocationRealtime(driverId);
    }
  }, [ongoingTrip, nearbyDrivers]);

  // Set up real-time driver location updates during ongoing trip
  useEffect(() => {
    let intervalId;

    if (ongoingTrip && ongoingTrip.driver_id && user.role === "rider") {
      console.log(
        `🔄 Starting real-time driver location updates for trip: ${ongoingTrip.trip_id}`
      );

      // Initial fetch
      updateDriverLocationRealtime(ongoingTrip.driver_id);

      // Set up interval for periodic updates (every 3 seconds)
      intervalId = setInterval(async () => {
        await updateDriverLocationRealtime(ongoingTrip.driver_id);
      }, 3000);

      setIsTracking(true);
    }

    // Cleanup interval on unmount or when trip ends
    return () => {
      if (intervalId) {
        console.log("🔄 Stopping real-time driver location updates");
        clearInterval(intervalId);
        setIsTracking(false);
      }
    };
  }, [ongoingTrip?.driver_id, ongoingTrip?.trip_id, user.role]);

  // Calculate real-time distance and ETA when driver location updates
  useEffect(() => {
    if (driverLocation && currentLocation) {
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        driverLocation.latitude,
        driverLocation.longitude
      );

      const eta = calculateETA(distance);

      setDistanceKm(distance);
      setEtaMinutes(Math.round(eta));

      // Calculate progress based on distance (simplified)
      const maxDistance = 10; // Maximum expected distance in km
      const progressPercent = Math.max(
        0,
        Math.min(100, ((maxDistance - distance) / maxDistance) * 100)
      );
      setProgress(progressPercent);

      console.log(`📍 Real-time calculations:`, {
        distance: distance.toFixed(2) + " km",
        eta: Math.round(eta) + " minutes",
        progress: Math.round(progressPercent) + "%",
      });
    }
  }, [driverLocation, currentLocation, calculateDistance, calculateETA]);

  // Real-time location tracking and WebSocket updates
  useEffect(() => {
    if (!ongoingTrip?.trip_id) return;

    setIsTracking(true);
    console.log("🚀 Starting real-time trip tracking");

    const interval = setInterval(() => {
      // Update ETA and distance (simulate driver moving closer)
      setEtaMinutes((prev) => {
        const newEta = Math.max(0, prev - 0.1);
        return +newEta.toFixed(1);
      });

      setDistanceKm((prev) => {
        const newDistance = Math.max(0, prev - 0.05);
        return +newDistance.toFixed(1);
      });

      setProgress((prev) => {
        const newProgress = Math.min(100, prev + 0.5);
        return +newProgress.toFixed(0);
      });

      // Send location updates via WebSocket for live tracking
      if (WebSocketController.isConnected() && currentLocation) {
        const locationUpdate = {
          type: "trip-location-update",
          data: {
            trip_id: ongoingTrip.trip_id,
            rider_id: user.id,
            driver_id: ongoingTrip.driver_id,
            rider_location: {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              timestamp: new Date().toISOString(),
            },
            driver_location: driverLocation
              ? {
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                  timestamp:
                    driverLocation.timestamp || new Date().toISOString(),
                }
              : null,
            eta: etaMinutes,
            distance: distanceKm,
            progress: progress,
            status: progress >= 100 ? "arrived" : "en_route",
          },
        };

        console.log("📡 Sending location update:", locationUpdate);
        WebSocketController.sendMessage(locationUpdate);
      }
    }, 3000);

    return () => {
      console.log("🛑 Stopping real-time trip tracking");
      clearInterval(interval);
      setIsTracking(false);
    };
  }, [
    ongoingTrip,
    user,
    currentLocation,
    driverLocation,
    etaMinutes,
    distanceKm,
    progress,
  ]);

  const handleEndTrip = () => {
    // Send trip end notification via WebSocket
    if (WebSocketController.isConnected()) {
      WebSocketController.sendMessage({
        type: "trip-ended",
        data: {
          trip_id: ongoingTrip?.trip_id,
          rider_id: user.id,
          driver_id: ongoingTrip?.driver_id,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Clear ongoing trip details
    dispatch({ type: "ongoingTripDetails/clearTrip" });

    // Navigate back to dashboard
    window.location.href =
      user.role === "rider" ? "/rider_dashboard" : "/driver_dashboard";
  };

  return (
    <div className="flex justify-center mb-10 pt-10">
      <div className="w-full max-w-6xl">
        {/* Real-time Tracking Status */}
        {isTracking && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-800">
                  Live Tracking Active
                </span>
              </div>
              <div className="text-xs text-green-600">
                Last update: {lastUpdate.toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <Header
          role={user.role || "driver"}
          handleEndTrip={handleEndTrip}
          userName={user.name || tripDetails.driver_name || "Alex Miller"}
        />

        {/* Content Container */}
        <div className="grid md:grid-cols-2 gap-6 pt-5">
          {/* Map Section */}
          <RouteMap />

          {/* Details Section */}
          <div className="space-y-6">
            {/* Status and Location Bar */}
            <LocationBar
              pickup_location={tripDetails.pickup_location}
              destination={tripDetails.destination}
              status={etaMinutes > 0 ? "En Route - Emergency" : "Arrived"}
            />

            <ETA
              eta={etaMinutes}
              distance={distanceKm}
              progressPercent={progress}
            />
            <Distance
              remainingDistanceKm={distanceKm}
              routeActive={progress < 100}
              progressPercent={progress}
            />

            {/* Real-time Location Info - Only for ongoing trip participants */}
            {currentLocation && ongoingTrip && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">
                  Live Tracking Details
                </h3>
                <div className="text-xs text-blue-600 space-y-1">
                  <div className="font-medium">👤 Rider Location</div>
                  <div>Latitude: {currentLocation.latitude.toFixed(6)}</div>
                  <div>Longitude: {currentLocation.longitude.toFixed(6)}</div>
                  {driverLocation && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <div className="font-medium">🚑 Driver Location</div>
                      <div>Latitude: {driverLocation.latitude.toFixed(6)}</div>
                      <div>
                        Longitude: {driverLocation.longitude.toFixed(6)}
                      </div>
                      <div className="font-medium">
                        Distance: {distanceKm} km
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Trip Details */}
            <div className="bg-slate-50 rounded-2xl">
              <OngoingTripDetails />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OngoingTrip;
