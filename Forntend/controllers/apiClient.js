export const API_BASE_URL = "http://127.0.0.1:8000";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const user = getStoredUser();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (user && user.token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${user.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  return response;
}

// Trip Requests
export async function createTripRequest(payload) {
  try {
    const response = await apiFetch("/trip-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data || { message: "Request failed" } };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}

export async function getTripRequests() {
  try {
    const response = await apiFetch("/trip-requests", {
      method: "GET",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data || { message: "Request failed" } };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}

// Notification API functions
export async function getNotifications() {
  try {
    const response = await apiFetch("/notifications", {
      method: "GET",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data || { message: "Request failed" } };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}

export async function updateNotificationStatus(notificationId, status) {
  try {
    const response = await apiFetch(`/notifications/${notificationId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data || { message: "Request failed" } };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}

// Driver availability API functions
export async function updateDriverAvailability(isAvailable) {
  try {
    console.log(`🔄 Updating driver availability to: ${isAvailable}`);

    const response = await apiFetch("/drivers/availability", {
      method: "PUT",
      body: JSON.stringify({
        is_available: isAvailable,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(
        `✅ Driver availability updated successfully: ${isAvailable}`
      );
      return { success: true, data };
    } else if (response.status === 404) {
      console.warn(`⚠️ Driver availability endpoint not implemented yet (404)`);
      console.warn(
        `⚠️ Backend needs to implement PUT /drivers/availability endpoint`
      );
      console.warn(`⚠️ For now, availability is only tracked locally`);
      return {
        success: false,
        error: "Endpoint not implemented",
        isNotImplemented: true,
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ Failed to update driver availability:`, errorData);
      return { success: false, error: errorData };
    }
  } catch (error) {
    console.error(`❌ Error updating driver availability:`, error);
    return { success: false, error: error.message };
  }
}

export async function setDriverOnline() {
  return updateDriverAvailability(true);
}

export async function setDriverOffline() {
  return updateDriverAvailability(false);
}

export async function getNotificationCount() {
  try {
    const response = await apiFetch("/notifications/count", {
      method: "GET",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data || { message: "Request failed" } };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}

export async function declineTripRequest(reqId) {
  try {
    const response = await apiFetch(`/trip-requests/${reqId}/decline`, {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data || { message: "Request failed" } };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}

export async function getDriverCount() {
  try {
    const response = await apiFetch("/drivers/count", {
      method: "GET",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data || { message: "Request failed" } };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}

// Get available drivers count
export async function getAvailableDriversCount() {
  try {
    const response = await apiFetch("/drivers/available-count", {
      method: "GET",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data || { message: "Request failed" } };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}

// Get available drivers list
export async function getAvailableDrivers() {
  try {
    const response = await apiFetch("/drivers/available", {
      method: "GET",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data || { message: "Request failed" } };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}

// Create notification
export async function createNotification(notificationData) {
  try {
    const response = await apiFetch("/notifications", {
      method: "POST",
      body: JSON.stringify(notificationData),
    });
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      return { success: false, error: data || { message: "Request failed" } };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
}