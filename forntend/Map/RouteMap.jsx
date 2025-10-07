import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSelector, useDispatch } from "react-redux";
import { searchNearbyHospitals } from "../../services/locationService";
import { apiFetch } from "../../controllers/apiClient";
import { addDriverBid } from "../../store/slices/bidding-slice";
import { getNotifications } from "../../controllers/apiClient";

// Fix for default markers in Leaflet with Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const RouteMap = ({ zoom = 13, height = "1000px" }) => {
  const dispatch = useDispatch();
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const routeLayerRef = useRef(null);
  const [hospitals, setHospitals] = useState([]);

  const user = useSelector((state) => state.user);
  const ongoingTrip = useSelector((state) => state.ongoingTripDetails);
  const nearbyDrivers = useSelector((state) => state.nearbyDrivers);
  const tripRequests = useSelector((state) => state.tripRequests);
  const biddingState = useSelector((state) => state.bidding);
  const bidNegotiationState = useSelector((state) => state.bidNegotiation);

  // Calculate states for rendering
  const isActiveBidding = tripRequests && tripRequests.length > 0;
  const isOngoingTrip = ongoingTrip?.rider_id === user.id;

  // State for real-time location updates (rider only)
  const [riderLocation, setRiderLocation] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // Function to fetch driver location from database
  const fetchDriverLocationFromDB = async (driverId) => {
    try {
      console.log(
        `🗄️ Fetching driver location from database for driver: ${driverId}`
      );
      console.log(`🔗 API endpoint: /driver-location/${driverId}`);
      console.log(`🔑 Token: ${user.token ? "Present" : "Missing"}`);

      const response = await apiFetch(`/driver-location/${driverId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      });

      console.log(`📡 Response status: ${response.status}`);
      console.log(`📡 Response headers:`, response.headers);

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Driver location fetched from API:`, data);
        console.log(
          `📍 Coordinates: lat=${data.latitude}, lng=${data.longitude}`
        );
        return data;
      } else {
        const errorText = await response.text();
        console.log(`❌ Failed to fetch driver location: ${response.status}`);
        console.log(`❌ Error response:`, errorText);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error fetching driver location:`, error);
      console.error(`❌ Error details:`, error.message);
      return null;
    }
  };

  // Real-time driver location update function
  const updateDriverLocationRealtime = async (driverId) => {
    try {
      console.log(
        `🔄 Fetching current location from driverlocation table for driver: ${driverId}`
      );
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
        setLastUpdateTime(new Date());

        console.log(`✅ Current location from database:`, {
          driver: driverId,
          lat: locationData.latitude,
          lng: locationData.longitude,
          timestamp: newLocation.timestamp,
        });
        console.log(
          `🎯 Exact coordinates: (${locationData.latitude}, ${locationData.longitude})`
        );
        return newLocation;
      } else {
        console.log(
          `⚠️ No location data found in driverlocation table for driver: ${driverId}`
        );
      }
    } catch (error) {
      console.error(`❌ Error fetching from driverlocation table:`, error);
    }
    return null;
  };

  // Real-time rider location update function using browser geolocation
  const updateRiderLocationRealtime = async () => {
    try {
      console.log(`🔄 Updating real-time rider location for user: ${user.id}`);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newRiderLocation = {
              id: user.id,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: new Date().toISOString(),
              name: user.name || "Rider",
              status: "bidding",
              realtime: true,
              accuracy: position.coords.accuracy,
            };

            setRiderLocation(newRiderLocation);
            setLastUpdateTime(new Date());

            console.log(`✅ Real-time rider location updated:`, {
              rider: user.id,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: newRiderLocation.timestamp,
            });
          },
          (error) => {
            console.error("❌ Error getting rider location:", error);
            // Fallback to stored user location
            if (user.latitude && user.longitude) {
              const fallbackLocation = {
                id: user.id,
                latitude: user.latitude,
                longitude: user.longitude,
                timestamp: new Date().toISOString(),
                name: user.name || "Rider",
                status: "bidding",
                realtime: false,
              };
              setRiderLocation(fallbackLocation);
              setLastUpdateTime(new Date());
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 1000,
          }
        );
      } else {
        console.log("⚠️ Geolocation not supported, using stored location");
        if (user.latitude && user.longitude) {
          const fallbackLocation = {
            id: user.id,
            latitude: user.latitude,
            longitude: user.longitude,
            timestamp: new Date().toISOString(),
            name: user.name || "Rider",
            status: "bidding",
            realtime: false,
          };
          setRiderLocation(fallbackLocation);
          setLastUpdateTime(new Date());
        }
      }
    } catch (error) {
      console.error("❌ Error in updateRiderLocationRealtime:", error);
    }
  };

  // Create custom icons similar to the image - orange circle style
  const createCustomIcon = (
    color,
    iconHtml,
    type = "rider",
    isRealtime = true
  ) => {
    const size = type === "hospital" ? 40 : 35;
    const borderWidth = type === "hospital" ? 4 : 3;

    return L.divIcon({
      className: "custom-marker",
      html: `<div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${borderWidth}px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: ${type === "hospital" ? "18px" : "16px"};
        font-weight: bold;
        position: relative;
        ${isRealtime ? "animation: pulse 2s infinite;" : ""}
      ">
        ${iconHtml}
        ${
          type === "rider"
            ? '<div style="position: absolute; top: -5px; right: -5px; width: 12px; height: 12px; background: #22c55e; border-radius: 50%; border: 2px solid white; animation: pulse 1.5s infinite;"></div>'
            : ""
        }
        ${
          type === "driver"
            ? '<div style="position: absolute; top: -5px; right: -5px; width: 12px; height: 12px; background: #3b82f6; border-radius: 50%; border: 2px solid white; animation: pulse 1.5s infinite;"></div>'
            : ""
        }
      </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  const icons = {
    rider: createCustomIcon("#f97316", "👤", "rider", true), // Orange rider marker like in image
    driver: createCustomIcon("#f97316", "🚑", "driver", true), // Orange driver marker like current location
    hospital: createCustomIcon("#ef4444", "🏥", "hospital", false), // Red hospital marker
  };

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return;

    // Use user location if available, otherwise default to Dhaka
    const defaultCoords =
      user.latitude && user.longitude
        ? [user.latitude, user.longitude]
        : [23.8103, 90.4125]; // Dhaka coordinates

    console.log(
      "🗺️ Initializing OpenStreetMap with coordinates:",
      defaultCoords
    );
    console.log("🗺️ User location:", {
      lat: user.latitude,
      lng: user.longitude,
    });

    mapRef.current = L.map("route-map").setView(defaultCoords, zoom);

    // Add a test marker to verify markers work
    const testMarker = L.marker(defaultCoords, {
      icon: L.divIcon({
        className: "test-marker",
        html: '<div style="background-color: red; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(mapRef.current);

    testMarker.bindPopup("Test marker - map is working!");
    console.log("🧪 Test marker added at:", defaultCoords);

    // Add OpenStreetMap tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
      minZoom: 1,
    }).addTo(mapRef.current);

    // Add a click event to get coordinates for debugging
    mapRef.current.on("click", function (e) {
      console.log("📍 Map clicked at coordinates:", e.latlng);
    });

    // Add CSS for real-time animations similar to the image style
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes pulse {
        0% { 
          transform: scale(1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        50% { 
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0,0,0,0.5);
        }
        100% { 
          transform: scale(1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
      }
      .custom-marker {
        background: transparent !important;
        border: none !important;
      }
      .leaflet-marker-icon {
        border-radius: 50% !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [zoom, user.latitude, user.longitude]);

  // Load hospitals when component mounts - only get the chosen hospital
  useEffect(() => {
    const loadHospitals = async () => {
      if (user.latitude && user.longitude) {
        try {
          const hospitalData = await searchNearbyHospitals("hospital", {
            latitude: user.latitude,
            longitude: user.longitude,
          });
          // Only keep the first hospital (chosen destination)
          setHospitals(hospitalData.slice(0, 1));
        } catch (error) {
          console.error("Error loading hospitals:", error);
        }
      }
    };

    loadHospitals();
  }, [user.latitude, user.longitude]);

  // Real-time location updates for both rider and driver during bidding and ongoing trips
  useEffect(() => {
    let intervalId;

    const startRealtimeUpdates = () => {
      console.log(
        "🔄 Starting real-time location updates for both rider and driver"
      );

      // Update rider location immediately
      updateRiderLocationRealtime();

      // Set up interval for periodic updates (every 2 seconds for better real-time experience)
      intervalId = setInterval(async () => {
        try {
          // Update rider location from browser geolocation
          updateRiderLocationRealtime();

          // Only update the currently displayed driver to prevent duplicates
          if (displayedDriverId) {
            console.log(
              `📍 Updating real-time location for displayed driver: ${displayedDriverId}`
            );
            await updateDriverLocationRealtime(displayedDriverId);
          } else {
            console.log(
              "🔍 No driver currently displayed, skipping driver location updates"
            );
          }
        } catch (error) {
          console.error("❌ Error in real-time location updates:", error);
        }
      }, 2000); // Update every 2 seconds for more responsive tracking
    };

    // Start real-time updates if user has location
    if (user.latitude && user.longitude) {
      startRealtimeUpdates();
    }

    // Cleanup interval on unmount
    return () => {
      if (intervalId) {
        console.log("🔄 Stopping real-time location updates");
        clearInterval(intervalId);
      }
    };
  }, [
    user.latitude,
    user.longitude,
    user.id,
    biddingState,
    bidNegotiationState,
    isOngoingTrip,
    ongoingTrip,
    displayedDriverId,
  ]);

  // Populate bidding state from notifications
  useEffect(() => {
    const populateBiddingFromNotifications = async () => {
      if (!user.id || user.role !== "rider") return;

      console.log("🔍 RouteMap - Current user:", {
        id: user.id,
        role: user.role,
        name: user.name,
      });

      try {
        const result = await getNotifications();
        console.log(
          "🔍 RouteMap - All notifications:",
          result.data?.notifications
        );
        if (result.success && result.data.notifications) {
          const driverBidNotifications = result.data.notifications.filter(
            (notif) =>
              (notif.notification_type === "driver_bid_sent" ||
                notif.notification_type === "driver_bid" ||
                notif.notification_type === "bid" ||
                notif.type === "driver_bid") &&
              (notif.status === "unread" ||
                notif.status === "pending" ||
                notif.status === "new" ||
                !notif.status) &&
              (notif.recipient_id === user.id ||
                notif.rider_id === user.id ||
                !notif.recipient_id ||
                !notif.rider_id)
          );

          console.log(
            "🔍 RouteMap - Found driver bid notifications:",
            driverBidNotifications.length
          );

          // Populate bidding state with notifications
          if (driverBidNotifications.length > 0) {
            const bidsFromNotifications = driverBidNotifications.map(
              (notif) => ({
                driver_id: notif.driver_id || notif.sender_id,
                driver_name:
                  notif.driver_name ||
                  `Driver ${notif.driver_id || notif.sender_id}`,
                rider_id: notif.rider_id || notif.recipient_id || user.id,
                req_id: notif.req_id || Date.now(),
                amount: notif.amount || notif.bid_amount || 300,
                status: "bid_submitted",
                timestamp:
                  notif.created_at ||
                  notif.timestamp ||
                  new Date().toISOString(),
                pickup_location: notif.pickup_location,
                destination: notif.destination,
              })
            );

            console.log(
              "🔍 RouteMap - Populating bidding state with:",
              bidsFromNotifications
            );

            // Dispatch to bidding state
            bidsFromNotifications.forEach((bid) => {
              dispatch(addDriverBid(bid));
            });
          }
        }
      } catch (error) {
        console.error(
          "❌ Error fetching notifications for bidding state:",
          error
        );
      }
    };

    populateBiddingFromNotifications();
  }, [user.id, user.role, dispatch]);

  // Update markers when locations change
  useEffect(() => {
    if (!mapRef.current) return;

    const updateMarkers = async () => {
      const map = mapRef.current;

      // Check if map is properly initialized
      if (!map || !map.getContainer()) {
        console.log("⚠️ Map not properly initialized, skipping marker update");
        return;
      }

      // Check if map is ready to prevent _leaflet_pos errors
      try {
        if (!map._loaded || !map._container || !map._container.parentNode) {
          console.log("⚠️ Map not fully loaded, waiting...");
          await new Promise((resolve) => setTimeout(resolve, 200));
          return updateMarkers(); // Retry after delay
        }
      } catch (error) {
        console.log("⚠️ Map readiness check failed, waiting...", error);
        await new Promise((resolve) => setTimeout(resolve, 200));
        return updateMarkers(); // Retry after delay
      }

      // Small delay to ensure map is fully ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear existing markers
      Object.values(markersRef.current).forEach((marker) => {
        map.removeLayer(marker);
      });
      markersRef.current = {};

      // Clear existing route
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }

      const bounds = [];
      let hasLocations = false;

      // Add rider location marker (always show when we have location data)
      const currentRiderLocation = riderLocation || user;
      if (currentRiderLocation.latitude && currentRiderLocation.longitude) {
        console.log("📍 Adding rider marker at:", {
          lat: currentRiderLocation.latitude,
          lng: currentRiderLocation.longitude,
          realtime: !!riderLocation,
        });

        try {
          const riderMarker = L.marker(
            [currentRiderLocation.latitude, currentRiderLocation.longitude],
            {
              icon: icons.rider,
            }
          ).addTo(map);

          console.log("✅ Rider marker added to map:", riderMarker);

          const popupContent = isOngoingTrip
            ? `
            <div style="text-align: center;">
              <h3 style="margin: 0 0 5px 0; color: #22c55e;">👤 ${
                currentRiderLocation.name || "Rider"
              }</h3>
              <p style="margin: 0; font-size: 12px;">📍 Real-time Location</p>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #666;">
                Lat: ${currentRiderLocation.latitude?.toFixed(6)}<br/>
                Lng: ${currentRiderLocation.longitude?.toFixed(6)}<br/>
                Status: Active Trip<br/>
                ${
                  riderLocation?.accuracy
                    ? `Accuracy: ${riderLocation.accuracy.toFixed(1)}m<br/>`
                    : ""
                }
                ${
                  riderLocation?.realtime
                    ? '<span style="color: #22c55e; font-weight: bold;">✓ Live tracking</span><br/>'
                    : ""
                }
                Updated: ${new Date(
                  riderLocation?.timestamp || Date.now()
                ).toLocaleTimeString()}
              </p>
            </div>
          `
            : `
        <div style="text-align: center;">
          <h3 style="margin: 0 0 5px 0; color: #22c55e;">👤 ${
            currentRiderLocation.name || "Rider"
          }</h3>
              <p style="margin: 0; font-size: 12px;">📍 Real-time Location</p>
          <p style="margin: 5px 0 0 0; font-size: 11px; color: #666;">
                Lat: ${currentRiderLocation.latitude?.toFixed(6)}<br/>
                Lng: ${currentRiderLocation.longitude?.toFixed(6)}<br/>
                Status: 🔴 Live bidding<br/>
                ${
                  riderLocation?.accuracy
                    ? `Accuracy: ${riderLocation.accuracy.toFixed(1)}m<br/>`
                    : ""
                }
                ${
                  riderLocation?.realtime
                    ? '<span style="color: #22c55e; font-weight: bold;">✓ Live geolocation</span><br/>'
                    : ""
                }
                Updated: ${new Date(
                  riderLocation?.timestamp || Date.now()
                ).toLocaleTimeString()}
          </p>
        </div>
          `;

          riderMarker.bindPopup(popupContent);

          markersRef.current.rider = riderMarker;
          bounds.push([
            currentRiderLocation.latitude,
            currentRiderLocation.longitude,
          ]);
          hasLocations = true;
        } catch (error) {
          console.error("❌ Error adding rider marker:", error);
        }
      }

      // Driver location markers removed - RouteMap now shows only rider and hospital

      // Remove pickup location marker - we only show rider, driver, and hospital

      // Add chosen hospital marker (destination) - always show when available
      if (hospitals.length > 0) {
        const hospital = hospitals[0];
        if (hospital.coordinates) {
          console.log("🏥 Adding hospital marker at:", {
            lat: hospital.coordinates.lat,
            lng: hospital.coordinates.lng,
            name: hospital.name,
          });

          try {
            const hospitalMarker = L.marker(
              [hospital.coordinates.lat, hospital.coordinates.lng],
              {
                icon: icons.hospital,
              }
            ).addTo(map);

            hospitalMarker.bindPopup(`
          <div style="text-align: center;">
            <h3 style="margin: 0 0 5px 0; color: #ef4444;">🏥 ${
              hospital.name
            }</h3>
              <p style="margin: 0; font-size: 12px;">📍 Destination</p>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #666;">
                Lat: ${hospital.coordinates.lat.toFixed(6)}<br/>
                Lng: ${hospital.coordinates.lng.toFixed(6)}<br/>
                Address: ${hospital.address}<br/>
                Rating: ${hospital.rating}/5<br/>
                Distance: ${
                  hospital.distance
                    ? hospital.distance.toFixed(1) + " km"
                    : "N/A"
                }
            </p>
          </div>
        `);

            markersRef.current.hospital = hospitalMarker;
            bounds.push([hospital.coordinates.lat, hospital.coordinates.lng]);
            hasLocations = true;
          } catch (error) {
            console.error("❌ Error adding hospital marker:", error);
          }
        }
      }

      // Remove additional hospital markers - we only show the chosen hospital

      // Draw route line from rider to hospital (destination) - only during ongoing trip
      if (
        markersRef.current.rider &&
        markersRef.current.hospital &&
        isOngoingTrip
      ) {
        const riderCoords = markersRef.current.rider.getLatLng();
        const hospitalCoords = markersRef.current.hospital.getLatLng();

        routeLayerRef.current = L.polyline([riderCoords, hospitalCoords], {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.7,
          dashArray: "10, 10",
        }).addTo(map);
      }

      // Fit map to show all markers based on current locations
      if (hasLocations && bounds.length > 0) {
        try {
          const group = new L.featureGroup();
          Object.values(markersRef.current).forEach((marker) => {
            if (marker && marker._map) {
              group.addLayer(marker);
            }
          });

          // Fit bounds to show all current locations
          const bounds_group = L.latLngBounds(bounds);

          // Check if map is properly initialized before fitting bounds
          if (map && map.getContainer() && bounds_group.isValid()) {
            map.fitBounds(bounds_group.pad(0.15));
            console.log("📍 Map fitted to show all markers:", {
              bounds: bounds_group.toString(),
              markerCount: bounds.length,
              markers: Object.keys(markersRef.current),
            });
          } else {
            console.warn(
              "⚠️ Map not ready for fitBounds, centering on user location"
            );
            if (
              currentRiderLocation.latitude &&
              currentRiderLocation.longitude
            ) {
              map.setView(
                [currentRiderLocation.latitude, currentRiderLocation.longitude],
                zoom
              );
            }
          }
        } catch (error) {
          console.error("❌ Error fitting map bounds:", error);
          // Fallback to centering on user location
          if (currentRiderLocation.latitude && currentRiderLocation.longitude) {
            try {
              map.setView(
                [currentRiderLocation.latitude, currentRiderLocation.longitude],
                zoom
              );
            } catch (fallbackError) {
              console.error(
                "❌ Error in fallback map centering:",
                fallbackError
              );
            }
          }
        }
      } else if (
        currentRiderLocation.latitude &&
        currentRiderLocation.longitude
      ) {
        // If no other markers, center on user location
        try {
          if (map && map.getContainer()) {
            map.setView(
              [currentRiderLocation.latitude, currentRiderLocation.longitude],
              zoom
            );
            console.log("📍 Map centered on user location:", {
              lat: currentRiderLocation.latitude,
              lng: currentRiderLocation.longitude,
              realtime: !!riderLocation,
            });
          }
        } catch (error) {
          console.error("❌ Error centering map on user location:", error);
        }
      }
    };

    updateMarkers();
  }, [
    user.latitude,
    user.longitude,
    ongoingTrip,
    nearbyDrivers,
    hospitals,
    tripRequests,
    biddingState,
    bidNegotiationState,
    driverLocation,
    riderLocation,
    lastUpdateTime,
    currentBidAmount,
  ]);

  return (
    <div className="relative">
      <div
        id="route-map"
        style={{
          height: height,
          width: "100%",
          borderRadius: "12px",
          border: "2px solid #e5e7eb",
        }}
      />

      {/* Map Legend - Real-time markers */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-xl z-[1000] border border-gray-200">
        <h4 className="text-sm font-bold mb-3 text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          OpenStreetMap Live Tracking
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-white text-xs animate-pulse shadow-md">
              👤
            </div>
            <div>
              <span className="font-semibold text-orange-700">Rider</span>
              <div className="text-gray-500">Current location</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-white text-xs animate-pulse shadow-md">
              🚑
            </div>
            <div>
              <span className="font-semibold text-orange-700">
                {isOngoingTrip ? "Assigned Driver" : "Bidding Driver"}
              </span>
              <div className="text-gray-500">
                {isOngoingTrip ? "Trip in progress" : "Single driver tracking"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-white text-xs shadow-md">
              🏥
            </div>
            <div>
              <span className="font-semibold text-red-700">Hospital</span>
              <div className="text-gray-500">Destination</div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
            {isOngoingTrip
              ? "Active trip in progress"
              : "Real-time bidding in progress"}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Click markers for live location details
          </div>
          <div className="text-xs text-green-600 mt-1 font-medium">
            🟢 Live geolocation tracking: Rider +{" "}
            {isOngoingTrip ? "Assigned Driver" : "Bidding Driver"}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            📍 Updates every 2 seconds
          </div>
          {user.latitude && user.longitude && (
            <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-50 rounded">
              <div className="font-medium text-gray-600">Your Location:</div>
              <div>Lat: {user.latitude.toFixed(6)}</div>
              <div>Lng: {user.longitude.toFixed(6)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

RouteMap.propTypes = {
  zoom: PropTypes.number,
  height: PropTypes.string,
};

export default RouteMap;
