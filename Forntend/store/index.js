import { configureStore } from "@reduxjs/toolkit";
import user from "./slices/user-slice.js";
import locationUpdateState from "./slices/location-update-state-slice.js";
import tripRequests from "./slices/trip-request-slice.js";
import riderResponse from "./slices/rider-response-slice.js";
import checkout from "./slices/checkout-status-slice.js";
import tripCheckout from "./slices/trip-checkout-slice.js";
import riderWaitingStatus from "./slices/rider-waiting-status-slice.js";
import driverResponses from "./slices/driver-response-slice.js";
import ongoingTripDetails from "./slices/ongoing-trip-details-slice.js";
import isOnATrip from "./slices/running-trip-indicator-slice.js";
import driverLocation from "./slices/driver-location-slice.js";
import nearbyDrivers from "./slices/nearby-drivers-slice.js";
import bidNegotiation from "./slices/bid-negotiation-slice.js";
import bidding from "./slices/bidding-slice.js";
import selectedHospital from "./slices/selected-hospital-slice.js";

const store = configureStore({
  reducer: {
    user,
    locationUpdateState,
    tripRequests,
    riderResponse,
    checkout,
    tripCheckout,
    riderWaitingStatus,
    driverResponses,
    ongoingTripDetails,
    isOnATrip,
    driverLocation,
    nearbyDrivers,
    bidNegotiation,
    bidding,
    selectedHospital,
  },
  // middleware: (getDefaultMiddleware) =>
  //     getDefaultMiddleware({
  //         serializableCheck: false,
  //     }),
});
export default store;
