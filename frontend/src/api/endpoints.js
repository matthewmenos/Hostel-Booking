// Thin wrappers around the REST API, grouped by domain.
import api from "./axios.js";

export const authApi = {
  login:                (username, password) => api.post("/auth/token/", { username, password }),
  register:             (payload) => api.post("/auth/register/", payload),
  me:                   () => api.get("/auth/me/"),
  updateMe:             (payload) => api.patch("/auth/me/", payload),
  requestPasswordReset: (email) => api.post("/auth/password-reset/", { email }),
  confirmPasswordReset: (uid, token, new_password) =>
    api.post("/auth/password-reset/confirm/", { uid, token, new_password }),
};

export const hostelApi = {
  search:      (params) => api.get("/hostels/", { params }),
  get:         (slug) => api.get(`/hostels/${slug}/`),
  create:      (payload) => api.post("/hostels/", payload),
  update:      (slug, payload) => api.patch(`/hostels/${slug}/`, payload),
  myHostels:   () => api.get("/my-hostels/"),
  gallery:     (slug) => api.get(`/hostels/${slug}/gallery/`),
  uploadImage: (slug, formData) =>
    api.post(`/hostels/${slug}/gallery/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteImage:    (id) => api.delete(`/gallery/${id}/`),
  roomPhotos:     (slug, roomType) => api.get(`/hostels/${slug}/room-photos/`, { params: roomType ? { room_type: roomType } : {} }),
  uploadRoomPhoto:(slug, formData) => api.post(`/hostels/${slug}/room-photos/`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  deleteRoomPhoto:(id) => api.delete(`/room-photos/${id}/`),
  reviews:        (slug) => api.get(`/hostels/${slug}/reviews/`),
  submitReview:   (slug, payload) => api.post(`/hostels/${slug}/reviews/`, payload),
  deleteReview:   (id) => api.delete(`/reviews/${id}/`),
};

export const managerApi = {
  getVerification:    () => api.get("/manager/verification/"),
  submitVerification: (fd) => api.post("/manager/verification/", fd),
};

export const notifApi = {
  list:        (params) => api.get("/notifications/", { params }),
  unreadCount: () => api.get("/notifications/unread-count/"),
  markRead:    (id) => api.post(`/notifications/${id}/read/`),
  markAllRead: () => api.post("/notifications/read-all/"),
  send:        (payload) => api.post("/notifications/send/", payload),
  report:      (payload) => api.post("/notifications/report/", payload),
};

export const bookingApi = {
  myBookings:     () => api.get("/bookings/"),
  book:           (payload) => api.post("/book/", payload),
  cancel:         (bookingId) => api.post(`/bookings/${bookingId}/cancel/`),
  downloadReceipt: async (bookingId) => {
    const res = await api.get(`/bookings/${bookingId}/receipt/`, { responseType: "blob" });
    const ext  = res.headers["content-type"]?.includes("pdf") ? "pdf" : "txt";
    const url  = URL.createObjectURL(res.data);
    const a    = document.createElement("a");
    a.href = url; a.download = `receipt_booking_${bookingId}.${ext}`; a.click();
    URL.revokeObjectURL(url);
  },
  managerBookings:(hostelSlug) =>
    api.get("/manager/bookings/", { params: hostelSlug ? { hostel: hostelSlug } : {} }),
  managerAnalytics: () => api.get("/manager/analytics/"),
  verifyPayment:  (reference) => api.get("/payments/verify/", { params: { reference } }),
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
  vacateBed:          (slug, id) => api.patch(`/tenant/beds/${id}/`, { is_occupied: false }, { tenant: slug }),
  announcements:      (slug) => api.get("/tenant/announcements/", { tenant: slug }),
  createAnnouncement: (slug, payload) => api.post("/tenant/announcements/", payload, { tenant: slug }),
  deleteAnnouncement: (slug, id) => api.delete(`/tenant/announcements/${id}/`, { tenant: slug }),
};

export const waitlistApi = {
  mine:       () => api.get("/waitlist/"),
  join:       (hostel, room_type) => api.post("/waitlist/", { hostel, room_type }),
  leave:      (hostelSlug, roomType) => api.delete(`/waitlist/${hostelSlug}/${roomType}/`),
  managerCounts: (hostelSlug) => api.get("/manager/waitlist/", { params: { hostel: hostelSlug } }),
};

export const roommateApi = {
  profile:       () => api.get("/roommates/profile/"),
  saveProfile:   (payload) => api.post("/roommates/profile/", payload),
  list:          (hostelSlug) => api.get("/roommates/", { params: { hostel: hostelSlug } }),
  requests:      () => api.get("/roommates/requests/"),
  sendRequest:   (payload) => api.post("/roommates/requests/", payload),
  decide:        (pk, action) => api.post(`/roommates/requests/${pk}/${action}/`),
};

export const renewalApi = {
  eligible: () => api.get("/bookings/renewal-eligible/"),
};

export const chatApi = {
  rooms:       ()              => api.get("/chat/rooms/"),
  room:        (id)            => api.get(`/chat/rooms/${id}/`),
  messages:    (id, params)    => api.get(`/chat/rooms/${id}/messages/`, { params }),
  postMessage: (id, payload)   => api.post(`/chat/rooms/${id}/messages/`, payload),
  react:       (msgId, emoji)  => api.post(`/chat/messages/${msgId}/react/`, { emoji }),
  markRead:    (id)            => api.post(`/chat/rooms/${id}/mark-read/`),
  unreadCount: ()              => api.get("/chat/unread-count/"),
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
  bookings:           (params) => api.get("/admin/bookings/", { params }),
  approveBooking:     (id) => api.post(`/admin/bookings/${id}/approve/`),
  refundBooking:      (id) => api.post(`/admin/bookings/${id}/refund/`),
  // Manager verifications
  verifications:      () => api.get("/admin/verifications/"),
  approveVerification:(id) => api.post(`/admin/verifications/${id}/approve/`),
  rejectVerification: (id, reason) => api.post(`/admin/verifications/${id}/reject/`, { rejection_reason: reason }),
};
