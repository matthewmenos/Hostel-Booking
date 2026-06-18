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
  gallery:   (slug) => api.get(`/hostels/${slug}/gallery/`),
  uploadImage: (slug, formData) =>
    api.post(`/hostels/${slug}/gallery/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteImage: (id) => api.delete(`/gallery/${id}/`),
};

export const bookingApi = {
  myBookings:     () => api.get("/bookings/"),
  book:           (payload) => api.post("/book/", payload),
  cancel:         (bookingId) => api.post(`/bookings/${bookingId}/cancel/`),
  receiptUrl:     (bookingId) => `/api/bookings/${bookingId}/receipt/`,
  managerBookings:(hostelSlug) =>
    api.get("/manager/bookings/", { params: hostelSlug ? { hostel: hostelSlug } : {} }),
  managerAnalytics: () => api.get("/manager/analytics/"),
};

// Tenant-scoped: pass { tenant: slug } so the X-Tenant-Slug header is set.
export const tenantApi = {
  rooms:              (slug) => api.get("/tenant/rooms/", { tenant: slug }),
  createRoom:         (slug, payload) => api.post("/tenant/rooms/", payload, { tenant: slug }),
  beds:               (slug) => api.get("/tenant/beds/", { tenant: slug }),
  createBed:          (slug, payload) => api.post("/tenant/beds/", payload, { tenant: slug }),
  bulkCreateBeds:     (slug, roomId, payload) =>
    api.post(`/tenant/rooms/${roomId}/bulk-beds/`, payload, { tenant: slug }),
  deleteBed:          (slug, id) => api.delete(`/tenant/beds/${id}/`, { tenant: slug }),
  announcements:      (slug) => api.get("/tenant/announcements/", { tenant: slug }),
  createAnnouncement: (slug, payload) => api.post("/tenant/announcements/", payload, { tenant: slug }),
  deleteAnnouncement: (slug, id) => api.delete(`/tenant/announcements/${id}/`, { tenant: slug }),
};

export const adminApi = {
  // Overview
  overview:          () => api.get("/admin/overview/"),
  // Platform settings
  settings:          () => api.get("/admin/settings/"),
  updateSettings:    (payload) => api.patch("/admin/settings/", payload),
  // Paystack
  paystackBalance:   () => api.get("/admin/paystack/balance/"),
  paystackTransfers: (params) => api.get("/admin/paystack/transfers/", { params }),
  // Manager payouts
  managers:          () => api.get("/admin/managers/"),
  setRecipient:      (id, code) => api.patch(`/admin/managers/${id}/recipient/`, { paystack_recipient_code: code }),
  // Users
  users:             () => api.get("/admin/users/"),
  updateUser:        (id, payload) => api.patch(`/admin/users/${id}/`, payload),
  // Hostels
  hostels:           () => api.get("/admin/hostels/"),
  activateHostel:    (slug) => api.post(`/admin/hostels/${slug}/activate/`),
  deactivateHostel:  (slug) => api.post(`/admin/hostels/${slug}/deactivate/`),
  verifyHostel:      (slug) => api.post(`/admin/hostels/${slug}/verify/`),
  // Bookings
  bookings:          (params) => api.get("/admin/bookings/", { params }),
  approveBooking:    (id) => api.post(`/admin/bookings/${id}/approve/`),
  refundBooking:     (id) => api.post(`/admin/bookings/${id}/refund/`),
};
