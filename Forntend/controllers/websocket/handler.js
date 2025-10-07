import WebSocketController from "./ConnectionManger";
import {
  addTripReq,
  clearTripReq,
} from "../../store/slices/trip-request-slice";
import store from "../../store";
import { setRiderResponse } from "../../store/slices/rider-response-slice";
import { addDriverResponse } from "../../store/slices/driver-response-slice";
import { setRiderWaitingStatus } from "../../store/slices/rider-waiting-status-slice";
import { setOngoingTripDetails } from "../../store/slices/ongoing-trip-details-slice";
import { setIsOnATrip } from "../../store/slices/running-trip-indicator-slice";
import { changeCheckoutStatus } from "../../store/slices/checkout-status-slice";
import {
  setDriverLocation,
  unsetDriverLocation,
} from "../../store/slices/driver-location-slice";
import {
  addDriver,
  updateDriver,
  removeDriver,
  setDrivers,
  setTracking,
} from "../../store/slices/nearby-drivers-slice";
import {
  startBidNegotiation,
  addRiderCounterOffer,
  addDriverCounterOffer,
  acceptBid,
  rejectBid,
} from "../../store/slices/bid-negotiation-slice";
import { logWebSocketDiagnostics } from "../../utils/websocketDiagnostics";
import {
  addDriverBid,
  addRiderBid,
  updateBidStatus,
  removeBid,
} from "../../store/slices/bidding-slice";
// Remove incorrect import - updateNearbyDrivers doesn't exist

// Track connection attempts to prevent multiple simultaneous connections
let connectionInProgress = false;

const ConnectToserver = async (
  id,
  role,
  token,
  retryCount = 0,
  maxRetries = 3
) => {
  // Prevent multiple simultaneous connection attempts
  if (connectionInProgress && retryCount === 0) {
    console.log(
      "⏳ Connection already in progress, skipping duplicate attempt"
    );
    return false;
  }

  connectionInProgress = true;
  try {
    console.log(
      `🔌 Connecting to WebSocket as ${role} with ID: ${id} (attempt ${
        retryCount + 1
      }/${maxRetries + 1})`
    );

    // Add a small delay for first connection attempt to ensure server is ready
    if (retryCount === 0) {
      console.log("⏳ Waiting 1 second before initial connection attempt...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const connectionResult = await WebSocketController.connect({
      logFunction: (message, type) => console.log(`[${type}] ${message}`),
      sendInitialMessage: true,
      initialMessage: {
        type: "new-client",
        data: {
          id,
          role,
          token, // include token here
        },
      },
      onOpen: () => {
        console.log("✅ Connected successfully");
        console.log(`👤 Active user: ${role} (ID: ${id})`);
      },
      onClose: (event) => {
        console.log("❌ Connection closed", event);
        console.log(`👤 Disconnected user: ${role} (ID: ${id})`);

        // Attempt to reconnect if it was an unexpected closure
        if (!event.wasClean && retryCount < maxRetries) {
          console.log(
            `🔄 Attempting to reconnect in 3 seconds... (${
              retryCount + 1
            }/${maxRetries})`
          );
          setTimeout(() => {
            ConnectToserver(id, role, token, retryCount + 1, maxRetries);
          }, 3000);
        }
      },
      onError: async (error) => {
        // Extract useful error information
        const errorInfo = {
          type: error.type || "unknown",
          target: error.target?.constructor?.name || "unknown",
          isTrusted: error.isTrusted || false,
          message: error.message || "WebSocket connection error",
          code: error.code || "unknown",
          reason: error.reason || "unknown",
        };

        console.error("❌ WebSocket error occurred:", errorInfo);
        console.error("❌ Full error object:", error);

        // Run diagnostics to help troubleshoot the issue
        try {
          await logWebSocketDiagnostics(error);
        } catch (diagError) {
          console.warn("⚠️ Failed to run WebSocket diagnostics:", diagError);
        }

        // Attempt to reconnect on error if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          console.log(
            `🔄 Connection error, attempting to reconnect in 5 seconds... (${
              retryCount + 1
            }/${maxRetries})`
          );
          setTimeout(() => {
            ConnectToserver(id, role, token, retryCount + 1, maxRetries);
          }, 5000);
        } else {
          console.error(
            "❌ Max reconnection attempts exceeded. WebSocket connection failed."
          );
          console.error(
            "💡 Check the diagnostics above for troubleshooting steps."
          );
        }
      },
      onMessage: (message) => HandleIncomingMessage(message),
      timeout: 10000, // 10 second timeout
    });

    connectionInProgress = false;
    return connectionResult;
  } catch (err) {
    connectionInProgress = false;
    console.log("❌ Connection error:", err);

    // Attempt to reconnect if we haven't exceeded max retries
    if (retryCount < maxRetries) {
      console.log(
        `🔄 Connection failed, attempting to reconnect in 5 seconds... (${
          retryCount + 1
        }/${maxRetries})`
      );
      setTimeout(() => {
        ConnectToserver(id, role, token, retryCount + 1, maxRetries);
      }, 5000);
    } else {
      console.error("❌ Max connection retries exceeded");
    }

    throw err;
  }
};

const DisconnectFromServer = async () => {
  try {
    await WebSocketController.disconnect({
      logFunction: (message, type) => console.log(`[${type}] ${message}`),
      code: 1000,
      reason: "User requested disconnect",
    });
  } catch (err) {
    console.log(err);
  }
};

const SendMessage = async (msg) => {
  let ok = false;

  // Check if WebSocket is connected before sending
  if (!WebSocketController.isConnected()) {
    console.warn(
      "⚠️ WebSocket not connected, attempting to reconnect for message:",
      msg.type || "unknown"
    );

    // Try to reconnect if we have user info
    try {
      const user = store.getState().user;
      if (user.id && user.role && user.token) {
        console.log("🔄 Attempting to reconnect WebSocket...");
        await ConnectToserver(user.id, user.role, user.token);

        // Wait a moment for connection to establish
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if reconnection was successful
        if (WebSocketController.isConnected()) {
          console.log("✅ WebSocket reconnected successfully");
        } else {
          console.warn("⚠️ WebSocket reconnection failed, skipping message");
          return false;
        }
      } else {
        console.warn(
          "⚠️ No user credentials available for reconnection, skipping message"
        );
        return false;
      }
    } catch (reconnectError) {
      console.error("❌ Failed to reconnect WebSocket:", reconnectError);
      return false;
    }
  }

  try {
    ok = await WebSocketController.sendMessage(msg, {
      logFunction: (message, type) => console.log(`[${type}] ${message}`),
    });
  } catch (err) {
    console.log("❌ Send message error:", err);
  }
  return ok;
};

async function HandleIncomingMessage(message /*,dispatch*/) {
  try {
    // Process incoming messages
    console.log("Processing message:", message);

    // Check if message is valid
    if (!message || typeof message !== "object" || message === null) {
      console.error("❌ Invalid message received:", message);
      return;
    }

    // Ensure message has required properties
    if (message.type === undefined && message.event === undefined) {
      console.warn("⚠️ Message missing type/event property:", message);
      message.type = "unknown";
    }

    const name = message.type || message.event || "unknown";

    // Debug: Log all message types
    console.log("Message type:", name, "Data:", message.data);

    // When a driver location update is received, update the nearby drivers in Redux
    if (name === "driver-location") {
      // message.data should contain { driver_id, latitude, longitude }
      if (message.data && typeof message.data === "object") {
        const driverId = message.data.driver_id || message.data.id;
        console.log(
          `🚑 Driver ID: ${driverId} is online now! Location: ${message.data.latitude}, ${message.data.longitude}`
        );

        // Convert to format expected by updateDriver
        const driverData = {
          driver_id: driverId,
          latitude: message.data.latitude,
          longitude: message.data.longitude,
          timestamp: message.data.timestamp,
          name: message.data.name || `Driver ${driverId}`,
          status: "available",
        };

        // Get current driver count before update
        const currentState = store.getState();
        const currentDriverCount = Object.keys(
          currentState.nearbyDrivers.drivers || {}
        ).length;

        store.dispatch(updateDriver(driverData));

        // Log updated count
        setTimeout(() => {
          const newState = store.getState();
          const newDriverCount = Object.keys(
            newState.nearbyDrivers.drivers || {}
          ).length;
          console.log(
            `📊 Driver count updated: ${currentDriverCount} → ${newDriverCount}`
          );
          if (newDriverCount !== currentDriverCount) {
            console.log(
              `🔄 Driver count changed by ${
                newDriverCount - currentDriverCount
              }`
            );
          }
        }, 100);
      } else {
        console.warn("⚠️ Invalid driver-location data:", message.data);
      }
    }

    // If you receive a list of nearby drivers
    if (name === "nearby-drivers") {
      console.log("🚑 Received nearby-drivers message:", message.data);
      // message.data should be an array of driver objects
      if (message.data && Array.isArray(message.data)) {
        console.log(`📊 Processing ${message.data.length} drivers`);

        // Get current driver count before update
        const currentState = store.getState();
        const currentDriverCount = Object.keys(
          currentState.nearbyDrivers.drivers || {}
        ).length;

        // Ensure each driver has the correct format
        const formattedDrivers = message.data.map((driver) => {
          const driverId = driver.id || driver.driver_id;
          console.log(`🚑 Driver ID: ${driverId} is online now!`);
          return {
            id: driverId,
            latitude: driver.latitude,
            longitude: driver.longitude,
            timestamp: driver.timestamp,
            name: driver.name || `Driver ${driverId}`,
            status: driver.status || "available",
          };
        });

        store.dispatch(setDrivers(formattedDrivers));

        // Log the update
        setTimeout(() => {
          console.log(
            `📊 Bulk driver update: ${currentDriverCount} → ${message.data.length} drivers`
          );
          console.log(
            `🔄 Driver count changed by ${
              message.data.length - currentDriverCount
            }`
          );
        }, 100);
      } else {
        console.warn("⚠️ Invalid nearby-drivers data:", message.data);
      }
    }

    // Log summary counts for important messages
    if (
      name === "nearby-drivers" ||
      name === "driver-location" ||
      name === "add-location" ||
      name === "update-location"
    ) {
      const driverCount =
        name === "nearby-drivers"
          ? Object.keys(message.data || {}).length
          : "Updated";
      console.log(`📊 SUMMARY: ${driverCount} drivers available`);
    }

    // Handle backend WebSocket messages
    if (name == "connection_established") {
      console.log("WebSocket connection established:", message.message);
      console.log("User ID:", message.user_id, "Role:", message.user_role);

      // Try to send any pending location updates
      try {
        const pendingUpdates = JSON.parse(
          localStorage.getItem("pendingLocationUpdates") || "[]"
        );
        if (pendingUpdates.length > 0) {
          console.log(
            `🔄 Found ${pendingUpdates.length} pending location updates, attempting to send...`
          );

          // Send the most recent update first
          const latestUpdate = pendingUpdates[pendingUpdates.length - 1];
          if (latestUpdate && latestUpdate.message) {
            const { default: WebSocketController } = await import(
              "./ConnectionManger"
            );
            const success = await WebSocketController.sendMessage(
              latestUpdate.message
            );
            if (success) {
              console.log("✅ Sent pending location update successfully");
              // Clear pending updates
              localStorage.removeItem("pendingLocationUpdates");
            } else {
              console.warn("⚠️ Failed to send pending location update");
            }
          }
        }
      } catch (error) {
        console.error("❌ Error processing pending location updates:", error);
      }

      return;
    }

    if (name == "client_registered") {
      console.log("Client registered:", message.message);
      return;
    }

    if (name == "location_updated") {
      console.log("Location updated:", message.data);
      // message.data: { driver_id, latitude, longitude, ... }
      if (message.data && message.data.driver_id !== undefined) {
        const driverData = {
          driver_id: message.data.driver_id,
          latitude: message.data.latitude,
          longitude: message.data.longitude,
          timestamp: message.data.timestamp,
          name: message.data.name || `Driver ${message.data.driver_id}`,
          status: "available",
        };
        store.dispatch(updateDriver(driverData));
      } else {
        console.warn("⚠️ Invalid location_updated data:", message.data);
      }
      return;
    }

    // Handle driver location updates from drivers themselves
    if (name === "add-location" || name === "update-location") {
      console.log(`🚑 Received ${name} message:`, message.data);
      // message.data: { driver_id, latitude, longitude, timestamp }
      if (message.data && message.data.driver_id !== undefined) {
        const driverData = {
          driver_id: message.data.driver_id,
          latitude: message.data.latitude,
          longitude: message.data.longitude,
          timestamp: message.data.timestamp || new Date().toISOString(),
          name: message.data.name || `Driver ${message.data.driver_id}`,
          status: "available",
        };

        // Get current driver count before update
        const currentState = store.getState();
        const currentDriverCount = Object.keys(
          currentState.nearbyDrivers.drivers || {}
        ).length;

        store.dispatch(updateDriver(driverData));

        // Log updated count
        setTimeout(() => {
          const newState = store.getState();
          const newDriverCount = Object.keys(
            newState.nearbyDrivers.drivers || {}
          ).length;
          console.log(
            `📊 ${name} - Driver count updated: ${currentDriverCount} → ${newDriverCount}`
          );
          if (newDriverCount !== currentDriverCount) {
            console.log(
              `🔄 Driver count changed by ${
                newDriverCount - currentDriverCount
              }`
            );
          }
        }, 100);
      } else {
        console.warn(`⚠️ Invalid ${name} data:`, message.data);
      }
      return;
    }

    if (name == "error") {
      console.error("WebSocket error:", message.message);
      return;
    }

    if (name == "pong") {
      console.log("Received pong response");
      return;
    }

    if (name == "broadcast_message") {
      console.log("Broadcast message:", message.message);
      return;
    }

    if (name == "echo") {
      console.log("Echo message:", message.original_message);
      return;
    }

    // Handle business logic messages (when backend implements them)
    if (name == "new-trip-request") {
      console.log("Dispatching new trip request...");
      store.dispatch(addTripReq(message.data));
    }
    if (name == "bid-from-rider") {
      console.log("Dispatching bid from rider...");
      store.dispatch(setRiderResponse({ fare: message.data.amount }));
    }
    if (name == "bid-from-driver") {
      console.log("🚑 Received bid-from-driver message:", message);
      console.log("🚑 Driver response data:", message.data);
      console.log("🚑 Dispatching bid from driver...");
      store.dispatch(addDriverResponse(message.data));
      store.dispatch(setRiderWaitingStatus({ isWaiting: false }));
      console.log("✅ Bid from driver dispatched successfully");
    }

    // Handle new bidding flow messages
    if (name == "driver-bid-offer") {
      console.log("🚑 Driver bid offer received:", message.data);
      store.dispatch(startBidNegotiation(message.data));
      store.dispatch(addDriverBid(message.data));
    }
    if (name == "rider-counter-offer") {
      console.log("🚗 Rider counter offer received:", message.data);
      store.dispatch(addRiderCounterOffer(message.data));
      store.dispatch(addRiderBid(message.data));

      // Dispatch custom event for real-time driver notification updates
      window.dispatchEvent(
        new CustomEvent("riderCounterOfferReceived", {
          detail: message.data,
        })
      );
    }
    if (name == "driver-counter-offer") {
      console.log("🚑 Driver counter offer received:", message.data);
      store.dispatch(addDriverCounterOffer(message.data));
      store.dispatch(addDriverBid(message.data));
    }
    if (name == "bid-accepted") {
      console.log("✅ Bid accepted:", message.data);
      store.dispatch(acceptBid(message.data));
      store.dispatch(
        updateBidStatus({
          driver_id: message.data.driver_id,
          req_id: message.data.req_id,
          status: "accepted",
        })
      );

      // If this includes trip details, set up the ongoing trip
      if (message.data.tripDetails) {
        store.dispatch(setOngoingTripDetails(message.data.tripDetails));
        store.dispatch(setIsOnATrip({ isOnATrip: true }));
        store.dispatch(clearTripReq());
        store.dispatch(changeCheckoutStatus());
        store.dispatch(
          removeBid({
            driver_id: message.data.driver_id,
            req_id: message.data.req_id,
          })
        );

        // Dispatch custom event for TripCheckout to listen
        window.dispatchEvent(
          new CustomEvent("bidAccepted", {
            detail: message.data.tripDetails,
          })
        );
      }
    }
    if (name == "bid-rejected") {
      console.log("❌ Bid rejected:", message.data);
      store.dispatch(rejectBid(message.data));
      store.dispatch(
        updateBidStatus({
          driver_id: message.data.driver_id,
          req_id: message.data.req_id,
          status: "rejected",
        })
      );
    }
    if (name == "trip-confirmed") {
      console.log("trip confirmed", message.data);
      store.dispatch(setOngoingTripDetails(message.data));
      store.dispatch(setIsOnATrip({ isOnATrip: true }));
      store.dispatch(clearTripReq());
      store.dispatch(changeCheckoutStatus());
    }
    if (name == "trip-ended") {
      console.log("🏁 Trip ended:", message.data);
      store.dispatch(setIsOnATrip({ isOnATrip: false }));
      store.dispatch(unsetDriverLocation());
      // Clear ongoing trip details
      store.dispatch({ type: "ongoingTripDetails/clearTrip" });
    }
    if (name == "trip-location-update") {
      console.log("📍 Trip location update:", message.data);
      // Handle real-time trip tracking updates
      if (message.data && message.data.trip_id) {
        // Update trip progress in Redux store
        store.dispatch({
          type: "ongoingTripDetails/updateTripProgress",
          payload: message.data,
        });

        // Update driver location if provided
        if (message.data.driver_location) {
          const driverData = {
            driver_id: message.data.driver_id,
            latitude: message.data.driver_location.latitude,
            longitude: message.data.driver_location.longitude,
            timestamp:
              message.data.driver_location.timestamp ||
              new Date().toISOString(),
            status: "available",
          };
          store.dispatch(updateDriver(driverData));
        }

        // Update rider location if provided
        if (message.data.rider_location) {
          store.dispatch({
            type: "user/updateLocation",
            payload: {
              latitude: message.data.rider_location.latitude,
              longitude: message.data.rider_location.longitude,
              timestamp: message.data.rider_location.timestamp,
            },
          });
        }

        // Dispatch custom event for real-time UI updates
        window.dispatchEvent(
          new CustomEvent("tripLocationUpdated", {
            detail: {
              tripId: message.data.trip_id,
              riderLocation: message.data.rider_location,
              driverLocation: message.data.driver_location,
              eta: message.data.eta,
              distance: message.data.distance,
              progress: message.data.progress,
              status: message.data.status,
            },
          })
        );
      }
    }
    if (name == "rider-accepted-bid") {
      console.log("🎉 Rider accepted bid:", message.data);
      // Create notification for driver about rider acceptance
      const notificationData = {
        notification_type: "rider_accepted_bid",
        title: "Rider Accepted Your Bid!",
        message: `${message.data.rider_name} has accepted your bid of ৳${message.data.amount}. You can now accept the trip or cancel.`,
        recipient_id: message.data.driver_id,
        recipient_type: "driver",
        sender_id: message.data.rider_id,
        sender_type: "rider",
        req_id: message.data.req_id,
        bid_amount: message.data.amount,
        pickup_location: message.data.pickup_location,
        destination: message.data.destination,
        rider_name: message.data.rider_name,
        status: "unread",
        timestamp: new Date().toISOString(),
      };

      // Dispatch custom event for real-time notification updates
      window.dispatchEvent(
        new CustomEvent("riderAcceptedBid", {
          detail: notificationData,
        })
      );
    }
    if (name == "trip-cancelled-by-driver") {
      console.log("❌ Trip cancelled by driver:", message.data);
      // Handle trip cancellation by driver after rider acceptance
      store.dispatch(
        updateBidStatus({
          driver_id: message.data.driver_id,
          req_id: message.data.req_id,
          status: "cancelled",
        })
      );

      // Dispatch custom event to notify rider side
      window.dispatchEvent(
        new CustomEvent("tripCancelledByDriver", {
          detail: message.data,
        })
      );
    }
    if (name == "driver-location") {
      // For single driver location update
      store.dispatch(updateDriver(message.data));
    }

    if (name == "nearby-drivers") {
      // For multiple driver locations (initial load)
      store.dispatch(setDrivers(message.data));
      store.dispatch(setTracking(true));
    }

    // Handle unknown message types
    if (name === "unknown") {
      console.warn("⚠️ Received unknown message type:", message);
      return;
    }
  } catch (error) {
    console.error("❌ Error processing message:", error.message);
    console.error("❌ Message that caused error:", message);
    // Don't re-throw the error to prevent WebSocket crashes
  }
}

export {
  ConnectToserver,
  DisconnectFromServer,
  SendMessage,
  HandleIncomingMessage,
};
