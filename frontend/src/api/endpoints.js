// Thin wrappers around the REST API, grouped by domain.
import api from "./axios.js";

export const authApi = {
  login:    (username, password) => api.post("/auth/token/", { username, password }),
  register: (payload) => api.post("/auth/register/", payload),
  me:       () => api.get("/auth/me/"),
  updateMe: (payload) => api.patch("/auth/me/", payload),
};

export const hostelApi = {
  search:    (params) => api.get("/hostels/", { params }),
  get:       (slug) => api.get(`/hostels/${slug}/`),
  create:    (payload) => api.post("/hostels/", payload),
  update:    (slug, payload) => api.patch(`/hostels/${slug}/`, payload),
  myHostels: () => api.get("/my-hostels/"),
};

export const bookingApi = {
  myBookings:     () => api.get("/bookings/"),
  book:           (payload) => api.post("/book/", payload),
  cancel:         (bookingId) => api.post(`/bookings/${bookingId}/cancel/`),
  managerBookings:(hostelSlug) =>
    api.get("/manager/bookings/", { params: hostelSlug ? { hostel: hostelSlug } : {} }),
};

// Tenant-scoped: pass { tenant: slug } so the X-Tenant-Slug header is set.
export const tenantApi = {
  rooms:              (slug) => api.get("/tenant/rooms/", { tenant: slug }),
  createRoom:         (slug, payload) => api.post("/tenant/rooms/", payload, { tenant: slug }),
  beds:               (slug) => api.get("/tenant/beds/", { tenant: slug }),
  createBed:          (slug, payload) => api.post("/tenant/beds/", payload, { tenant: slug }),
  deleteBed:          (slug, id) => api.delete(`/tenant/beds/${id}/`, { tenant: slug }),
  announcements:      (slug) => api.get("/tenant/announcements/", { tenant: slug }),
  createAnnouncement: (slug, payload) => api.post("/tenant/announcements/", payload, { tenant: slug }),
  deleteAnnouncement: (slug, id) => api.delete(`/tenant/announcements/${id}/`, { tenant: slug }),
};

export const adminApi = {
  users:             () => api.get("/admin/users/"),
  updateUser:        (id, payload) => api.patch(`/admin/users/${id}/`, payload),
  hostels:           () => api.get("/admin/hostels/"),
  activateHostel:    (slug) => api.post(`/admin/hostels/${slug}/activate/`),
  deactivateHostel:  (slug) => api.post(`/admin/hostels/${slug}/deactivate/`),
  bookings:          (params) => api.get("/admin/bookings/", { params }),
  refundBooking:     (id) => api.post(`/admin/bookings/${id}/refund/`),
};
