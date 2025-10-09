import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Car, DollarSign, Clock } from "lucide-react";
import {
  getNotifications,
  updateNotificationStatus,
} from "../../../controllers/apiClient";
import { useSelector, useDispatch } from "react-redux";
import { setOngoingTripDetails } from "../../../store/slices/ongoing-trip-details-slice";
import { clearTripReq } from "../../../store/slices/trip-request-slice";
import { changeCheckoutStatus } from "../../../store/slices/checkout-status-slice";
import WebSocketController from "../../../controllers/websocket/ConnectionManger";

const DriverBidPopup = () => {
  const [notifications, setNotifications] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const user = useSelector((state) => state.user);
  const dispatch = useDispatch();

  // Fetch driver bid notifications
  useEffect(() => {
    const fetchDriverBidNotifications = async () => {
      if (!user.id || user.role !== "rider") return;

      try {
        const result = await getNotifications();

        if (result.success && result.data && result.data.notifications) {
          const driverBidNotifications = result.data.notifications.filter(
            (notif) =>
              notif.notification_type === "driver_bid_sent" &&
              notif.status === "unread"
          );

          if (driverBidNotifications.length > 0) {
            setNotifications(driverBidNotifications);
            setIsVisible(true);
            console.log(
              "🔔 Driver bid popup notifications:",
              driverBidNotifications
            );
          }
        }
      } catch (error) {
        console.error("Error fetching driver bid notifications:", error);
      }
    };

    fetchDriverBidNotifications();

    // Poll for new notifications every 5 seconds
    const interval = setInterval(fetchDriverBidNotifications, 5000);
    return () => clearInterval(interval);
  }, [user.id, user.role]);

  // Handle cancel notification
  const handleCancelNotification = async (notificationId) => {
    try {
      console.log("🚫 Cancelling notification:", notificationId);

      // Find the notification to get driver info
      const notification = notifications.find(
        (notif) => notif.notification_id === notificationId
      );

      // Update notification status to cancelled
      const response = await updateNotificationStatus(
        notificationId,
        "cancelled"
      );

      if (response.success) {
        console.log("✅ Notification cancelled successfully");

        // Remove from local state
        setNotifications((prev) =>
          prev.filter((notif) => notif.notification_id !== notificationId)
        );

        // Hide popup if no more notifications
        if (notifications.length <= 1) {
          setIsVisible(false);
        }

        // Dispatch event to notify driver side that rider cancelled
        window.dispatchEvent(
          new CustomEvent("riderCancelledBid", {
            detail: {
              notificationId,
              timestamp: new Date().toISOString(),
              riderId: user.id,
              driverId: notification?.sender_id, // Driver is the sender in rider notifications
            },
          })
        );

        // Also dispatch the original event for backward compatibility
        window.dispatchEvent(
          new CustomEvent("driverBidCancelled", {
            detail: { notificationId },
          })
        );
      }
    } catch (error) {
      console.error("Error cancelling notification:", error);
    }
  };

  // Handle accept notification
  const handleAcceptNotification = async (notification) => {
    try {
      console.log("✅ Accepting notification:", notification.notification_id);

      // Create trip details
      const tripDetails = {
        trip_id: `trip_${Date.now()}`,
        rider_id: user.id,
        driver_id: notification.sender_id,
        driver_name: notification.driver_name,
        driver_mobile: notification.driver_mobile,
        pickup_location: notification.pickup_location,
        destination: notification.destination,
        fare: notification.bid_amount,
        status: "confirmed",
        timestamp: new Date().toISOString(),
      };

      // Send acceptance via WebSocket
      await WebSocketController.sendMessage({
        type: "bid-accepted",
        data: {
          rider_id: user.id,
          driver_id: notification.sender_id,
          req_id: notification.req_id,
          amount: notification.bid_amount,
          tripDetails: tripDetails,
        },
      });

      // Send notification to driver about rider acceptance
      await WebSocketController.sendMessage({
        type: "rider-accepted-bid",
        data: {
          rider_id: user.id,
          driver_id: notification.sender_id,
          req_id: notification.req_id,
          amount: notification.bid_amount,
          pickup_location: notification.pickup_location,
          destination: notification.destination,
          rider_name: user.name || `Rider ${user.id}`,
          driver_name: notification.driver_name,
          tripDetails: tripDetails,
        },
      });

      // Update notification status to accepted
      const response = await updateNotificationStatus(
        notification.notification_id,
        "accepted"
      );

      if (response.success) {
        console.log("✅ Notification accepted, driver notified");

        // Update Redux state
        dispatch(setOngoingTripDetails(tripDetails));
        dispatch(clearTripReq());
        dispatch(changeCheckoutStatus());

        // Remove from local state
        setNotifications((prev) =>
          prev.filter(
            (notif) => notif.notification_id !== notification.notification_id
          )
        );

        // Hide popup
        setIsVisible(false);

        // Navigate to ongoing trip
        window.location.href = "/ongoing_trip";
      }
    } catch (error) {
      console.error("Error accepting notification:", error);
    }
  };

  if (!isVisible || notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.notification_id}
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-sm"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Driver Bid Received</h3>
                    <p className="text-blue-100 text-sm">
                      {notification.driver_name} sent you a bid
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    handleCancelNotification(notification.notification_id)
                  }
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="space-y-3">
                {/* Driver Info */}
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Car className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {notification.driver_name}
                    </p>
                    <p className="text-sm text-gray-600">EMT Service</p>
                  </div>
                </div>

                {/* Bid Amount */}
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-700">
                      ৳{notification.bid_amount}
                    </span>
                    <span className="text-green-600 text-sm">bid amount</span>
                  </div>
                </div>

                {/* Trip Details */}
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">
                        To: {notification.destination}
                      </p>
                      <p className="text-xs text-gray-500">
                        From: {notification.pickup_location}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={() =>
                      handleCancelNotification(notification.notification_id)
                    }
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={() => handleAcceptNotification(notification)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Car className="w-4 h-4" />
                    <span>Accept</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-2 rounded-b-xl">
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>Just now</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default DriverBidPopup;
