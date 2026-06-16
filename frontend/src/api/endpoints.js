// Thin typed-ish wrappers around the REST API, grouped by domain.
import api from "./axios.js";

export const authApi = {
  login: (username, password) =>
    api.post("/auth/token/", { username, password }),
  register: (payload) => api.post("/auth/register/", payload),
  me: () => api.get("/auth/me/"),
};

export const hostelApi = {
  search: (params) => api.get("/hostels/", { params }),
  get: (slug) => api.get(`/hostels/${slug}/`),
  create: (payload) => api.post("/hostels/", payload),
  myHostels: () => api.get("/my-hostels/"),
};

export const bookingApi = {
  myBookings: () => api.get("/bookings/"),
  book: (payload) => api.post("/book/", payload),
};

// Tenant-scoped: pass the hostel slug so the X-Tenant-Slug header is set.
export const tenantApi = {
  rooms: (slug) => api.get("/tenant/rooms/", { tenant: slug }),
  createRoom: (slug, payload) =>
    api.post("/tenant/rooms/", payload, { tenant: slug }),
  beds: (slug) => api.get("/tenant/beds/", { tenant: slug }),
  createBed: (slug, payload) =>
    api.post("/tenant/beds/", payload, { tenant: slug }),
  announcements: (slug) => api.get("/tenant/announcements/", { tenant: slug }),
  createAnnouncement: (slug, payload) =>
    api.post("/tenant/announcements/", payload, { tenant: slug }),
};
