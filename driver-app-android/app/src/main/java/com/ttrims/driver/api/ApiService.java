package com.ttrims.driver.api;

import com.ttrims.driver.models.ApiResponse;
import com.ttrims.driver.models.AttendanceSession;
import com.ttrims.driver.models.Shipment;
import com.ttrims.driver.models.User;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.*;

/**
 * Retrofit API interface — mirrors the backend REST endpoints needed by the driver app.
 */
public interface ApiService {

    // ── Auth ────────────────────────────────────────────────────────────────────

    @POST("auth/login")
    Call<ApiResponse<LoginData>> login(@Body Map<String, String> body);

    @GET("users/me")
    Call<ApiResponse<User>> me();

    @POST("auth/logout")
    Call<ApiResponse<Void>> logout();

    class LoginData {
        public String accessToken;
        public String refreshToken;
        public boolean sessionPermanent;
        public User user;
    }

    // ── Shipments ───────────────────────────────────────────────────────────────

    /** Get all shipments assigned to the currently authenticated driver. */
    @GET("shipments/driver/assigned")
    Call<ApiResponse<List<Shipment>>> listAssignedShipments();

    /** Update the top-level shipment status (e.g. CREATED → EN_ROUTE). */
    @PATCH("shipments/{id}/status")
    Call<ApiResponse<Shipment>> updateShipmentStatus(
            @Path("id") String id,
            @Body Map<String, String> body  // { "status": "EN_ROUTE" }
    );

    /** Record per-stop Proof of Delivery. */
    @PATCH("shipments/{id}/stop/{stopId}")
    Call<ApiResponse<Shipment>> updateStopStatus(
            @Path("id") String shipmentId,
            @Path("stopId") String stopId,
            @Body Map<String, Object> body
    );

    /** Driver pushes current GPS coordinates to the backend. */
    @POST("shipments/driver/location")
    Call<ApiResponse<Void>> reportLocation(@Body Map<String, Double> body);

    /** Update driver duty status (AVAILABLE, BUSY, OFFLINE, VEHICLE_BREAKDOWN). */
    @PATCH("shipments/driver/status")
    Call<ApiResponse<Map<String, String>>> updateDriverStatus(
            @Body Map<String, String> body  // { "status": "AVAILABLE" }
    );

    // ── Attendance ──────────────────────────────────────────────────────────────

    @POST("attendance/start")
    Call<ApiResponse<AttendanceSession>> attendanceStart(@Body Map<String, Object> body);

    @POST("attendance/{id}/stop")
    Call<ApiResponse<AttendanceSession>> attendanceStop(@Path("id") String sessionId);

    @POST("attendance/{id}/ping")
    Call<ApiResponse<Void>> attendancePing(
            @Path("id") String sessionId,
            @Body Map<String, Object> body
    );

    @GET("attendance/my")
    Call<ApiResponse<List<AttendanceSession>>> myAttendance();
}
