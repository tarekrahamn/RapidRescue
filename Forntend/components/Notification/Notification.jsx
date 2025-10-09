import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import {
  Check,
  X,
  Clock,
  AlertCircle,
  MapPin,
  User,
  Phone,
  ChevronRight,
  Bell,
  DollarSign,
  Plus,
  Minus,
} from "lucide-react";
import { setOngoingTripDetails } from "../../store/slices/ongoing-trip-details-slice";
import { clearTripReq } from "../../store/slices/trip-request-slice";
import { changeCheckoutStatus } from "../../store/slices/checkout-status-slice";
import WebSocketController from "../../controllers/websocket/ConnectionManger";
import {
  getNotifications,
  updateNotificationStatus,
} from "../../controllers/apiClient";

const Notification = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const driverResponses = useSelector((state) => state.driverResponse);
  const [notifications, setNotifications] = useState([]);
  const [bidAmount, setBidAmount] = useState(250);
  const [showBidInput, setShowBidInput] = useState(null);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  // Fetch notifications from database
  const fetchNotifications = async () => {
    if (user.id && (user.role === "rider" || user.role === "driver")) {
      try {
        console.log(
          `🔔 Notification.jsx - Fetching notifications for ${user.role}:`,
          user.id
        );
        const result = await getNotifications();
        console.log(`🔔 Notification.jsx - API response:`, result);

        if (result.success && result.data.notifications) {
          // Filter notifications based on user role and type
          const filteredNotifications = result.data.notifications.filter(
            (notif) => {
              console.log(`🔔 Notification.jsx - Checking notification:`, {
                id: notif.notification_id,
                type: notif.notification_type,
                recipient: notif.recipient_id,
                sender: notif.sender_id,
                status: notif.status,
                currentUser: user.id,
                currentRole: user.role,
              });

              // FIRST: Only exclude denied/rejected notifications for the current user
              if (
                (notif.status === "denied" || notif.status === "rejected") &&
                notif.recipient_id === user.id
              ) {
                console.log(
                  `❌ IMMEDIATE EXCLUSION - Denied notification for current user:`,
                  {
                    id: notif.notification_id,
                    status: notif.status,
                    title: notif.title,
                    recipient: notif.recipient_id,
                    currentUser: user.id,
                  }
                );
                return false;
              }

              if (user.role === "rider") {
                // For riders: show driver bids, counter-offers, and driver decline notifications where rider is the recipient
                // Exclude denied/rejected notifications
                const isForRider = notif.recipient_id === user.id;
                const isRelevantType =
                  notif.notification_type === "driver_bid_sent" ||
                  notif.notification_type === "bid" ||
                  notif.notification_type === "driver_bid" ||
                  notif.notification_type === "counter_offer" ||
                  notif.notification_type === "driver_declined_request";
                const isNotDenied =
                  notif.status !== "denied" && notif.status !== "rejected";
                const isRelevantStatus =
                  (showAllNotifications && notif.status !== "read") ||
                  notif.status === "unread" ||
                  notif.status === "pending" ||
                  notif.status === "new" ||
                  !notif.status;

                console.log(`🔔 Rider filter:`, {
                  notificationId: notif.notification_id,
                  status: notif.status,
                  isForRider,
                  isRelevantType,
                  isNotDenied,
                  isRelevantStatus,
                  showAllNotifications,
                  isReadStatus: notif.status === "read",
                  passes:
                    isForRider &&
                    isRelevantType &&
                    isNotDenied &&
                    isRelevantStatus,
                });

                // Additional check: explicitly exclude denied and read notifications
                if (
                  notif.status === "denied" ||
                  notif.status === "rejected" ||
                  notif.status === "read"
                ) {
                  console.log(`❌ Rider filter - EXCLUDING notification:`, {
                    id: notif.notification_id,
                    status: notif.status,
                    title: notif.title,
                  });
                  return false;
                }

                return (
                  isForRider &&
                  isRelevantType &&
                  isNotDenied &&
                  isRelevantStatus
                );
              } else if (user.role === "driver") {
                // For drivers: show rider counter-offers and rider accepted bid notifications where driver is the recipient
                // Exclude denied/rejected notifications
                const isForDriver = notif.recipient_id === user.id;
                const isRelevantType =
                  notif.notification_type === "rider_counter_offer" ||
                  notif.notification_type === "counter_offer" ||
                  notif.notification_type === "rider_bid" ||
                  notif.notification_type === "rider_accepted_bid";
                const isNotDenied =
                  notif.status !== "denied" && notif.status !== "rejected";
                const isRelevantStatus =
                  (showAllNotifications && notif.status !== "read") ||
                  notif.status === "unread" ||
                  notif.status === "pending" ||
                  notif.status === "new" ||
                  !notif.status;

                console.log(`🔔 Driver filter:`, {
                  notificationId: notif.notification_id,
                  status: notif.status,
                  isForDriver,
                  isRelevantType,
                  isNotDenied,
                  isRelevantStatus,
                  showAllNotifications,
                  passes:
                    isForDriver &&
                    isRelevantType &&
                    isNotDenied &&
                    isRelevantStatus,
                });

                // Additional check: explicitly exclude denied notifications
                if (notif.status === "denied" || notif.status === "rejected") {
                  console.log(
                    `❌ Driver filter - EXCLUDING denied notification:`,
                    {
                      id: notif.notification_id,
                      status: notif.status,
                      title: notif.title,
                    }
                  );
                  return false;
                }

                return (
                  isForDriver &&
                  isRelevantType &&
                  isNotDenied &&
                  isRelevantStatus
                );
              }
              return false;
            }
          );

          console.log(
            `🔔 Notification.jsx - Filtered notifications for ${user.role}:`,
            filteredNotifications
          );

          // Debug: Show what notifications were filtered out
          const excludedNotifications = result.data.notifications.filter(
            (notif) => {
              const isForUser = notif.recipient_id === user.id;
              const isDenied =
                notif.status === "denied" || notif.status === "rejected";
              return isForUser && isDenied;
            }
          );

          if (excludedNotifications.length > 0) {
            console.log(
              `❌ Excluded denied notifications for ${user.role}:`,
              excludedNotifications
            );
          }

          const dbNotifications = filteredNotifications.map((notif) => {
            console.log(`🔔 Notification.jsx - Processing notification:`, {
              id: notif.notification_id,
              type: notif.notification_type,
              recipient: notif.recipient_id,
              sender: notif.sender_id,
              title: notif.title,
              message: notif.message,
              status: notif.status,
            });

            // FINAL CHECK: Double-check that no denied notifications slip through for current user
            if (
              (notif.status === "denied" || notif.status === "rejected") &&
              notif.recipient_id === user.id
            ) {
              console.log(
                `❌ FINAL CHECK - BLOCKING denied notification for current user:`,
                {
                  id: notif.notification_id,
                  status: notif.status,
                  title: notif.title,
                  recipient: notif.recipient_id,
                  currentUser: user.id,
                }
              );
              return null; // This will be filtered out later
            }

            return {
              id: `db-${notif.notification_id}`,
              type:
                user.role === "rider"
                  ? notif.notification_type === "bid"
                    ? "driver_bid"
                    : notif.notification_type === "driver_declined_request"
                    ? "driver_declined"
                    : "counter_offer"
                  : notif.notification_type === "driver_bid_sent" ||
                    notif.notification_type === "rider_counter_offer" ||
                    notif.notification_type === "counter_offer" ||
                    notif.notification_type === "rider_bid"
                  ? "rider_bid"
                  : notif.notification_type === "rider_accepted_bid"
                  ? "rider_accepted_bid"
                  : "bid",
              title: notif.title,
              message: notif.message,
              location: notif.pickup_location || "Pickup Location",
              requestedBy:
                user.role === "rider"
                  ? notif.driver_name || `Driver ${notif.sender_id}`
                  : notif.rider_name || `Rider ${notif.sender_id}`,
              timestamp: new Date(notif.timestamp).toLocaleTimeString(),
              priority: "high",
              status: notif.status || "pending",
              driverData: {
                driver_id: notif.sender_id,
                driver_name: notif.driver_name,
                driver_mobile: notif.driver_mobile,
                req_id: notif.req_id,
                pickup_location: notif.pickup_location,
                destination: notif.destination,
              },
              bidData: {
                rider_id: notif.sender_id,
                req_id: notif.req_id,
                pickup_location: notif.pickup_location,
                destination: notif.destination,
              },
              bidAmount: notif.bid_amount,
              notificationId: notif.notification_id,
              notificationType: notif.notification_type,
            };
          });

          // Filter out any null values (blocked denied notifications)
          const validNotifications = dbNotifications.filter(
            (notif) => notif !== null
          );

          console.log(
            `🔔 Notification.jsx - Processed notifications:`,
            validNotifications
          );
          console.log(
            `🔔 Notification.jsx - Blocked denied notifications:`,
            dbNotifications.length - validNotifications.length
          );

          // Final debug: Show what notifications are being displayed
          console.log(
            `🔔 Notification.jsx - FINAL NOTIFICATIONS TO DISPLAY:`,
            validNotifications.map((notif) => ({
              id: notif.id,
              title: notif.title,
              status: notif.status || "no status",
              type: notif.type,
              bidAmount: notif.bidAmount,
              driverData: notif.driverData,
            }))
          );

          // Check for any denied notifications that might have slipped through
          const deniedInFinal = validNotifications.filter(
            (notif) => notif.status === "denied" || notif.status === "rejected"
          );
          if (deniedInFinal.length > 0) {
            console.log(
              `❌ WARNING: Denied notifications found in final display:`,
              deniedInFinal
            );
          }

          // Final safety filter: Remove any denied notifications that slipped through
          const finalCleanNotifications = validNotifications.filter(
            (notif) => notif.status !== "denied" && notif.status !== "rejected"
          );

          if (finalCleanNotifications.length !== validNotifications.length) {
            console.log(
              `🧹 FINAL CLEANUP: Removed ${
                validNotifications.length - finalCleanNotifications.length
              } denied notifications`
            );
          }

          setNotifications(finalCleanNotifications);
        }
      } catch (error) {
        console.error("❌ Error fetching notifications:", error);
      }
    }
  };

  // useEffect to call fetchNotifications
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      // Refresh notifications every 5 seconds
      const interval = setInterval(fetchNotifications, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, user.id, user.role, showAllNotifications]);

  const handleAccept = async (notification) => {
    console.log(
      `🔔 Notification.jsx - handleAccept called for ${user.role}:`,
      notification
    );

    if (user.role === "rider" && notification.type === "driver_bid") {
      const driverData = notification.driverData;

      // Create ongoing trip details
      const tripDetails = {
        trip_id: Date.now(),
        rider_id: user.id,
        driver_id: driverData.driver_id,
        driver_name: driverData.driver_name,
        driver_mobile: driverData.driver_mobile,
        pickup_location: driverData.pickup_location,
        destination: driverData.destination,
        fare: notification.bidAmount,
        status: "confirmed",
        timestamp: new Date().toISOString(),
      };

      // Send acceptance via WebSocket
      await WebSocketController.sendMessage({
        type: "bid-accepted",
        data: {
          rider_id: user.id,
          driver_id: driverData.driver_id,
          req_id: driverData.req_id,
          amount: notification.bidAmount,
          tripDetails: tripDetails,
        },
      });

      // Send notification to driver about rider acceptance
      await WebSocketController.sendMessage({
        type: "rider-accepted-bid",
        data: {
          rider_id: user.id,
          driver_id: driverData.driver_id,
          req_id: driverData.req_id,
          amount: notification.bidAmount,
          pickup_location: driverData.pickup_location,
          destination: driverData.destination,
          rider_name: user.name || `Rider ${user.id}`,
          driver_name: driverData.driver_name,
          tripDetails: tripDetails,
        },
      });

      // Update notification status in database
      if (notification.notificationId) {
        await updateNotificationStatus(notification.notificationId, "accepted");
      }

      // Update local state for rider
      dispatch(setOngoingTripDetails(tripDetails));
      dispatch(clearTripReq());
      dispatch(changeCheckoutStatus());

      // Remove notification
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notification.id)
      );

      // Navigate to ongoing trip
      window.location.href = "/ongoing_trip";
    } else if (user.role === "driver" && notification.type === "rider_bid") {
      const bidData = notification.bidData;

      console.log(
        `🔔 Notification.jsx - Driver accepting rider counter-offer:`,
        bidData
      );

      // Create ongoing trip details
      const tripDetails = {
        trip_id: Date.now(),
        rider_id: bidData.rider_id,
        driver_id: user.id,
        driver_name: user.name,
        driver_mobile: user.mobile,
        pickup_location: bidData.pickup_location,
        destination: bidData.destination,
        fare: notification.bidAmount,
        status: "confirmed",
        timestamp: new Date().toISOString(),
      };

      // Send acceptance via WebSocket
      await WebSocketController.sendMessage({
        type: "counter-offer-accepted",
        data: {
          rider_id: bidData.rider_id,
          driver_id: user.id,
          req_id: bidData.req_id,
          amount: notification.bidAmount,
          tripDetails: tripDetails,
          notificationId: notification.notificationId,
        },
      });

      // Update notification status in database
      if (notification.notificationId) {
        await updateNotificationStatus(notification.notificationId, "accepted");
      }

      // Remove notification
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notification.id)
      );

      // Dispatch custom event to notify TripCheckout to stop loading
      window.dispatchEvent(
        new CustomEvent("riderCounterOfferAccepted", {
          detail: {
            riderAmount: notification.bidAmount,
            riderId: bidData.rider_id,
            reqId: bidData.req_id,
            pickupLocation: bidData.pickup_location,
            destination: bidData.destination,
            tripDetails: tripDetails,
          },
        })
      );

      console.log(
        "✅ Notification accepted - loading indicator should stop in TripCheckout"
      );

      console.log(
        `🔔 Notification.jsx - Dispatched riderCounterOfferAccepted event with amount: ${notification.bidAmount}`
      );
    }
  };

  const handleReject = async (notification) => {
    console.log(
      `🔔 Notification.jsx - handleReject called for ${user.role}:`,
      notification
    );

    if (user.role === "driver" && notification.type === "rider_bid") {
      // Update notification status in database
      if (notification.notificationId) {
        await updateNotificationStatus(notification.notificationId, "rejected");
      }

      // Send rejection via WebSocket
      await WebSocketController.sendMessage({
        type: "counter-offer-rejected",
        data: {
          rider_id: notification.bidData.rider_id,
          driver_id: user.id,
          req_id: notification.bidData.req_id,
          notificationId: notification.notificationId,
        },
      });

      // Remove notification
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notification.id)
      );
    }
  };

  const handleMakeBid = async (notification) => {
    // Rider wants to use this bid - navigate to BidNegotiation component
    console.log("🔄 handleMakeBid called with notification:", notification);

    if (notification.bid_amount || notification.bidAmount) {
      const bidAmount = notification.bid_amount || notification.bidAmount;
      console.log("🔄 Rider wants to use driver bid:", bidAmount);

      try {
        // Store the selected notification data for BidNegotiation component
        const bidData = {
          notificationId:
            notification.notification_id || notification.notificationId,
          driverId:
            notification.driver_id || notification.driverData?.driver_id,
          driverName:
            notification.driver_name || notification.driverData?.driver_name,
          driverMobile:
            notification.driver_mobile ||
            notification.driverData?.driver_mobile,
          bidAmount: bidAmount,
          pickupLocation:
            notification.pickup_location ||
            notification.driverData?.pickup_location,
          destination:
            notification.destination || notification.driverData?.destination,
          reqId: notification.req_id || notification.driverData?.req_id,
          timestamp: new Date().toISOString(),
        };

        // Store in localStorage for BidNegotiation component to access
        localStorage.setItem(
          "selectedBidNotification",
          JSON.stringify(bidData)
        );

        // Dispatch event to notify BidNegotiation component
        window.dispatchEvent(
          new CustomEvent("bidNotificationSelected", {
            detail: bidData,
          })
        );

        // Close notification panel
        onClose();

        // Navigate to bid negotiation page
        console.log("🔄 Navigating to /bid_negotiation");
        window.location.href = "/bid_negotiation";
        console.log(
          "✅ Bid notification selected, navigating to BidNegotiation"
        );
      } catch (error) {
        console.error("❌ Error selecting bid notification:", error);
      }
    }
  };

  const handleSendBid = async (notification) => {
    if (notification.type === "driver_bid") {
      const driverData = notification.driverData;

      // Send counter bid via WebSocket
      await WebSocketController.sendMessage({
        type: "rider-counter-offer",
        data: {
          rider_id: user.id,
          driver_id: driverData.driver_id,
          req_id: driverData.req_id,
          amount: bidAmount,
          original_amount: notification.bidAmount,
        },
      });

      // Update notification with new bid
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notification.id
            ? {
                ...notif,
                bidAmount: bidAmount,
                message: `Counter offer: ৳${bidAmount}`,
              }
            : notif
        )
      );

      setShowBidInput(null);
    }
  };

  const handleCancel = async (id) => {
    try {
      // Find the notification to get its database ID
      const notification = notifications.find((notif) => notif.id === id);

      if (notification && notification.notificationId) {
        // Update notification status in database to "cancelled"
        await updateNotificationStatus(
          notification.notificationId,
          "cancelled"
        );
        console.log(
          "✅ Notification cancelled in database:",
          notification.notificationId
        );
      }

      // Remove from local state
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
      console.log("✅ Notification removed from local state");

      // Dispatch event to notify driver side that rider cancelled
      window.dispatchEvent(
        new CustomEvent("riderCancelledBid", {
          detail: {
            notificationId: id,
            timestamp: new Date().toISOString(),
            riderId: user.id,
          },
        })
      );
      console.log("✅ Rider cancelled bid, notifying driver side");
    } catch (error) {
      console.error("❌ Error cancelling notification:", error);
      // Still remove from local state even if database update fails
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    }
  };

  const handleGetBackToRiderForm = async (notification) => {
    console.log(
      "🔄 Notification - Get back to rider form clicked:",
      notification
    );

    try {
      // Update notification status in database
      if (notification.notificationId) {
        await updateNotificationStatus(notification.notificationId, "read");
        console.log("✅ Driver decline notification marked as read");
      }

      // Remove from local state
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notification.id)
      );
      console.log("✅ Driver decline notification removed from local state");

      // Clear trip request from store
      console.log("🔄 Notification - Clearing trip request from store");
      dispatch(clearTripReq());
      console.log("✅ Trip request cleared from store");

      // Dispatch event to flip back to RideSearchForm
      window.dispatchEvent(
        new CustomEvent("flipToRideSearchForm", {
          detail: {
            reason: "driver_declined_request",
            reqId: notification.driverData?.req_id,
            timestamp: new Date().toISOString(),
          },
        })
      );

      console.log("✅ flipToRideSearchForm event dispatched");

      // Close notification panel
      onClose();
    } catch (error) {
      console.error("❌ Error handling get back to rider form:", error);
    }
  };

  const handleAcceptTrip = async (notification) => {
    console.log("🚗 Driver accepting trip:", notification);

    try {
      // Create ongoing trip details
      const tripDetails = {
        trip_id: Date.now(),
        rider_id:
          notification.bidData?.rider_id || notification.driverData?.rider_id,
        driver_id: user.id,
        driver_name: user.name,
        driver_mobile: user.mobile,
        pickup_location:
          notification.bidData?.pickup_location ||
          notification.driverData?.pickup_location,
        destination:
          notification.bidData?.destination ||
          notification.driverData?.destination,
        fare: notification.bidAmount,
        status: "confirmed",
        timestamp: new Date().toISOString(),
      };

      // Send trip acceptance via WebSocket
      await WebSocketController.sendMessage({
        type: "trip-confirmed",
        data: {
          rider_id: tripDetails.rider_id,
          driver_id: user.id,
          req_id:
            notification.bidData?.req_id || notification.driverData?.req_id,
          amount: notification.bidAmount,
          tripDetails: tripDetails,
          notificationId: notification.notificationId,
        },
      });

      // Update notification status in database
      if (notification.notificationId) {
        await updateNotificationStatus(notification.notificationId, "accepted");
      }

      // Update local state for driver
      dispatch(setOngoingTripDetails(tripDetails));
      dispatch(clearTripReq());
      dispatch(changeCheckoutStatus());

      // Remove notification
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notification.id)
      );

      // Dispatch event to notify rider side
      window.dispatchEvent(
        new CustomEvent("tripConfirmedByDriver", {
          detail: {
            tripDetails: tripDetails,
            amount: notification.bidAmount,
            riderId: tripDetails.rider_id,
            driverId: user.id,
          },
        })
      );

      console.log("✅ Trip confirmed by driver, notifying rider side");
    } catch (error) {
      console.error("❌ Error accepting trip:", error);
    }
  };

  const handleCancelTrip = async (notification) => {
    console.log("❌ Driver canceling trip:", notification);

    try {
      // Send trip cancellation via WebSocket
      await WebSocketController.sendMessage({
        type: "trip-cancelled-by-driver",
        data: {
          rider_id:
            notification.bidData?.rider_id || notification.driverData?.rider_id,
          driver_id: user.id,
          req_id:
            notification.bidData?.req_id || notification.driverData?.req_id,
          amount: notification.bidAmount,
          notificationId: notification.notificationId,
          reason: "driver_cancelled_after_acceptance",
        },
      });

      // Update notification status in database
      if (notification.notificationId) {
        await updateNotificationStatus(
          notification.notificationId,
          "cancelled"
        );
      }

      // Remove notification
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notification.id)
      );

      // Dispatch event to notify rider side
      window.dispatchEvent(
        new CustomEvent("tripCancelledByDriver", {
          detail: {
            amount: notification.bidAmount,
            riderId:
              notification.bidData?.rider_id ||
              notification.driverData?.rider_id,
            driverId: user.id,
            reason: "driver_cancelled_after_acceptance",
          },
        })
      );

      console.log("✅ Trip cancelled by driver, notifying rider side");
    } catch (error) {
      console.error("❌ Error cancelling trip:", error);
    }
  };

  const removeNotification = (id) => {
    console.log("🗑️ removeNotification called with id:", id);
    console.log(
      "🗑️ Current notifications before removal:",
      notifications.length
    );
    setNotifications((prev) => {
      const filtered = prev.filter((notif) => notif.id !== id);
      console.log("🗑️ Notifications after removal:", filtered.length);
      return filtered;
    });
  };

  const handleBidAmountChange = (amount) => {
    setBidAmount((prev) => Math.max(0, prev + amount));
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "critical":
        return "border-red-500 bg-red-50";
      case "high":
        return "border-orange-500 bg-orange-50";
      case "medium":
        return "border-yellow-500 bg-yellow-50";
      case "low":
        return "border-blue-500 bg-blue-50";
      default:
        return "border-gray-300 bg-gray-50";
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case "critical":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "high":
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case "medium":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "low":
        return <Bell className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeIcon = (type) => {
    return type === "emergency" ? (
      <Phone className="w-3 h-3 text-red-600" />
    ) : (
      <MapPin className="w-3 h-3 text-blue-600" />
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black bg-opacity-25"
          />

          {/* Notification Panel */}
          <motion.div
            initial={{ opacity: 0, x: 300, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-4 top-24 z-50 w-96 max-h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="bg-gradient-to-r from-red-600 to-red-500 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notifications ({notifications.length})
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      console.log("🔄 Force refreshing notifications...");
                      fetchNotifications();
                    }}
                    className="px-2 py-1 text-xs rounded transition-colors text-white hover:bg-white hover:bg-opacity-20"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() =>
                      setShowAllNotifications(!showAllNotifications)
                    }
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      showAllNotifications
                        ? "bg-white text-red-600"
                        : "text-white hover:bg-white hover:bg-opacity-20"
                    }`}
                  >
                    {showAllNotifications ? "Hide All" : "Show All"}
                  </button>
                  <button
                    onClick={onClose}
                    className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              <div className="divide-y divide-gray-200">
                <AnimatePresence>
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -300 }}
                      transition={{ duration: 0.3 }}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        notification.status !== "pending" ? "opacity-75" : ""
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Priority Indicator */}
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center ${getPriorityColor(
                            notification.priority
                          )}`}
                        >
                          {getPriorityIcon(notification.priority)}
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            {getTypeIcon(notification.type)}
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {notification.title}
                            </h3>
                          </div>

                          <p className="text-xs text-gray-700 mb-2 line-clamp-2">
                            {notification.message}
                          </p>

                          <div className="flex flex-col gap-1 text-xs text-gray-600 mb-3">
                            <div className="flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              <span className="truncate">
                                {notification.location}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                {notification.requestedBy}
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {notification.timestamp}
                              </div>
                            </div>
                          </div>

                          {/* Status Indicator */}
                          {notification.status !== "pending" && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                notification.status === "accepted"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {notification.status === "accepted" ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Accepted
                                </>
                              ) : (
                                <></>
                              )}
                            </motion.div>
                          )}

                          {/* Action Buttons - Rider */}
                          {user.role === "rider" &&
                            (notification.status === "pending" ||
                              notification.status === "unread" ||
                              notification.status === "new" ||
                              !notification.status) &&
                            notification.type === "driver_bid" && (
                              <div className="space-y-3">
                                {/* Simple Action Buttons */}
                                <div className="flex space-x-2">
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleAccept(notification)}
                                    className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center space-x-1 text-xs font-medium transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Accept</span>
                                  </motion.button>

                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleMakeBid(notification)}
                                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-1 text-xs font-medium transition-colors"
                                  >
                                    <DollarSign className="w-3 h-3" />
                                    <span>Use This Bid</span>
                                  </motion.button>

                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() =>
                                      handleCancel(notification.id)
                                    }
                                    className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center space-x-1 text-xs font-medium transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Cancel</span>
                                  </motion.button>
                                </div>
                              </div>
                            )}

                          {/* Driver Decline Notification - Rider */}
                          {user.role === "rider" &&
                            (notification.status === "pending" ||
                              notification.status === "unread" ||
                              notification.status === "new" ||
                              !notification.status) &&
                            notification.type === "driver_declined" && (
                              <div className="space-y-3">
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <p className="text-xs text-red-700 font-medium mb-2">
                                    ⚠️ A driver has declined your request
                                  </p>
                                  <p className="text-xs text-red-600">
                                    You can get back to the rider form to search
                                    for other drivers.
                                  </p>
                                </div>

                                <div className="flex space-x-2">
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() =>
                                      handleGetBackToRiderForm(notification)
                                    }
                                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-1 text-xs font-medium transition-colors"
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                    <span>Get Back to Rider Form</span>
                                  </motion.button>

                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={async () => {
                                      // Update database status to "read"
                                      if (notification.notificationId) {
                                        try {
                                          await updateNotificationStatus(
                                            notification.notificationId,
                                            "read"
                                          );
                                          console.log(
                                            "✅ Driver decline notification dismissed"
                                          );
                                        } catch (error) {
                                          console.error(
                                            "❌ Error dismissing notification:",
                                            error
                                          );
                                        }
                                      }
                                      // Remove from local state
                                      removeNotification(notification.id);
                                    }}
                                    className="px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center space-x-1 text-xs font-medium transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Dismiss</span>
                                  </motion.button>
                                </div>
                              </div>
                            )}

                          {/* Action Buttons - Driver */}
                          {user.role === "driver" &&
                            (notification.status === "pending" ||
                              notification.status === "unread" ||
                              notification.status === "new" ||
                              !notification.status) &&
                            notification.type === "rider_bid" && (
                              <div className="space-y-3">
                                {/* Driver Action Buttons */}
                                <div className="flex space-x-2">
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleAccept(notification)}
                                    className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center space-x-1 text-xs font-medium transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Accept</span>
                                  </motion.button>

                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() =>
                                      handleCancel(notification.id)
                                    }
                                    className="flex-1 px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center space-x-1 text-xs font-medium transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Cancel</span>
                                  </motion.button>
                                </div>

                                {/* Show accepted amount if notification is accepted */}
                                {notification.status === "accepted" && (
                                  <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-xs text-green-700 font-medium">
                                      ✅ Accepted Amount: ৳
                                      {notification.bidAmount}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                          {/* Rider Accepted Bid Notification - Driver */}
                          {user.role === "driver" &&
                            (notification.status === "pending" ||
                              notification.status === "unread" ||
                              notification.status === "new" ||
                              !notification.status) &&
                            notification.type === "rider_accepted_bid" && (
                              <div className="space-y-3">
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <p className="text-xs text-green-700 font-medium mb-2">
                                    🎉 Rider accepted your bid!
                                  </p>
                                  <p className="text-xs text-green-600">
                                    The rider has accepted your bid of ৳
                                    {notification.bidAmount}. You can now accept
                                    the trip or cancel.
                                  </p>
                                </div>

                                <div className="flex space-x-2">
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() =>
                                      handleAcceptTrip(notification)
                                    }
                                    className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center space-x-1 text-xs font-medium transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Accept Trip</span>
                                  </motion.button>

                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() =>
                                      handleCancelTrip(notification)
                                    }
                                    className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center space-x-1 text-xs font-medium transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Cancel</span>
                                  </motion.button>
                                </div>
                              </div>
                            )}
                        </div>

                        {/* Remove button for completed notifications */}
                        {notification.status !== "pending" && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={async () => {
                              console.log(
                                "🗑️ X button clicked for notification:",
                                notification.id,
                                "Type:",
                                notification.type,
                                "Status:",
                                notification.status
                              );

                              // For driver decline notifications, update database status first
                              if (
                                notification.type === "driver_declined" &&
                                notification.notificationId
                              ) {
                                try {
                                  console.log(
                                    "🗑️ Updating driver decline notification status to 'read'"
                                  );
                                  await updateNotificationStatus(
                                    notification.notificationId,
                                    "read"
                                  );
                                  console.log(
                                    "✅ Driver decline notification marked as read"
                                  );
                                } catch (error) {
                                  console.error(
                                    "❌ Error updating notification status:",
                                    error
                                  );
                                }
                              }
                              // Then remove from local state
                              console.log(
                                "🗑️ Removing notification from local state:",
                                notification.id
                              );
                              removeNotification(notification.id);
                            }}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                            title="Remove notification"
                          >
                            <X className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {notifications.length === 0 && (
                  <div className="p-8 text-center">
                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-gray-900 mb-1">
                      No notifications
                    </h3>
                    <p className="text-xs text-gray-500">
                      You're all caught up!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Notification;
