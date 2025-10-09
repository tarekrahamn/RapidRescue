import React from "react";
import { useSelector } from "react-redux";
import {
  User,
  Phone,
  DollarSign,
  MapPin,
  Navigation,
  Clock,
  Shield,
} from "lucide-react";

const OngoingTripDetails = ({ role, tripData }) => {
  // Get trip details from Redux state
  const ongoingTrip = useSelector((state) => state.ongoingTripDetails);
  const user = useSelector((state) => state.user);
  
  console.log("🔍 OngoingTripDetails - ongoingTrip from Redux:", ongoingTrip);
  console.log("🔍 OngoingTripDetails - user from Redux:", user);
  
  // Use Redux data if available, otherwise fallback to default data
  const data = {
    rider_name: ongoingTrip.rider_name || user.name || "John Doe",
    rider_mobile: ongoingTrip.rider_mobile || user.mobile || "+1234567890",
    driver_name: ongoingTrip.driver_name || "Jane Smith",
    driver_mobile: ongoingTrip.driver_mobile || "+9876543210",
    pickup_location: ongoingTrip.pickup_location || "City Hospital Emergency Entrance",
    destination: ongoingTrip.destination || "Downtown Medical Center - ER",
    fare: ongoingTrip.fare || 250,
    start_time: "14:30", // This could be calculated from timestamp
    estimated_arrival: "14:42", // This could be calculated
  };
  
  console.log("🔍 OngoingTripDetails - final data object:", data);

  return (
    <div className="space-y-5">
      {/* Passenger/Driver Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-red-500 to-red-600 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-white font-semibold text-base">
              {role === "driver" ? "Patient Details" : "Driver Details"}
            </h2>
          </div>
          <div className="flex items-center bg-white/20 px-3 py-1 rounded-full">
            <Shield className="w-4 h-4 text-white mr-1" />
            <span className="text-xs text-white">Verified</span>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-xl">
            <div className="bg-red-100 p-2.5 rounded-xl">
              <User className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                Name
              </p>
              <p className="text-gray-800 font-semibold">
                {role === "driver" ? data.rider_name : data.driver_name}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-xl">
            <div className="bg-green-100 p-2.5 rounded-xl">
              <Phone className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                Phone
              </p>
              <p className="text-gray-800 font-semibold">
                {role === "driver" ? data.rider_mobile : data.driver_mobile}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-xl">
            <div className="bg-blue-100 p-2.5 rounded-xl">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                Pickup Time
              </p>
              <p className="text-gray-800 font-semibold">{data.start_time}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-xl">
            <div className="bg-purple-100 p-2.5 rounded-xl">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                Est. Arrival
              </p>
              <p className="text-gray-800 font-semibold">
                {data.estimated_arrival}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Route Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-white font-semibold text-base">
            Route Information
          </h2>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start space-x-4">
            <div className="bg-blue-100 p-2.5 rounded-xl mt-1">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                Pickup Location
              </p>
              <p className="text-gray-800 font-semibold">
                {data.pickup_location}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="bg-purple-100 p-2.5 rounded-xl mt-1">
              <Navigation className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                Destination
              </p>
              <p className="text-gray-800 font-semibold">{data.destination}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Fare Card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-white font-semibold text-base">Trip Fare</h2>
          </div>
          <span className="text-xs text-white bg-white/20 px-2 py-1 rounded-full">
            Fixed Price
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-4 p-3 bg-green-50 rounded-xl">
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 p-2.5 rounded-xl">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider">
                  Total Fare
                </p>
                <p className="text-gray-800 font-semibold">
                  Emergency Transport
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">
                {data.fare} tk
              </p>
              <p className="text-xs text-gray-500">Includes all charges</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 p-2 rounded-lg">
              <span className="text-gray-500">Base fare:</span>
              <span className="float-right font-medium">200 tk</span>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg">
              <span className="text-gray-500">Emergency fee:</span>
              <span className="float-right font-medium">50 tk</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

OngoingTripDetails.defaultProps = {
  role: "patient",
  tripData: {},
};

export default OngoingTripDetails;
