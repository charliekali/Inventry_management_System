package com.ttrims.ims.api;

import com.ttrims.ims.models.ApiResponse;
import com.ttrims.ims.models.AttendanceSession;
import com.ttrims.ims.models.Shipment;
import com.ttrims.ims.models.User;
import com.ttrims.ims.models.Product;
import com.ttrims.ims.models.Warehouse;
import com.ttrims.ims.models.Transaction;
import com.ttrims.ims.models.Recipe;
import com.ttrims.ims.models.ProductionRun;
import com.ttrims.ims.models.KeyItem;
import com.ttrims.ims.models.KeyLogItem;
import com.ttrims.ims.models.Role;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.*;

/**
 * ApiService — Unified REST interface for the entire TTRIMS system.
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

    // ── Dashboard Stats ─────────────────────────────────────────────────────────

    @GET("dashboard/stats")
    Call<ApiResponse<DashboardStats>> getDashboardStats();

    class DashboardStats {
        public int totalItems;
        public int lowStockCount;
        public List<Product> lowStockItems;
        public List<Transaction> recentTransactions;
    }

    // ── Products & Inventory ────────────────────────────────────────────────────

    @GET("products")
    Call<ApiResponse<List<Product>>> getProducts(@Query("search") String query);

    @POST("transactions/in")
    Call<ApiResponse<Transaction>> logStockIn(@Body Map<String, Object> payload);

    @POST("transactions/out")
    Call<ApiResponse<Transaction>> logStockOut(@Body Map<String, Object> payload);

    // ── Warehouses ──────────────────────────────────────────────────────────────

    @GET("warehouses")
    Call<ApiResponse<List<Warehouse>>> getWarehouses();

    @POST("warehouses")
    Call<ApiResponse<Warehouse>> createWarehouse(@Body Map<String, String> payload);

    @POST("warehouses/{id}/sections")
    Call<ApiResponse<Warehouse.Section>> createSection(
            @Path("id") String warehouseId,
            @Body Map<String, String> payload);

    // ── Sales ───────────────────────────────────────────────────────────────────

    @POST("sales/invoices")
    Call<ApiResponse<Void>> completeCheckout(@Body Map<String, Object> payload);

    // ── Production ──────────────────────────────────────────────────────────────

    @GET("recipes")
    Call<ApiResponse<List<Recipe>>> getRecipes();

    @POST("recipes")
    Call<ApiResponse<Recipe>> createRecipe(@Body Map<String, String> payload);

    @GET("production-runs")
    Call<ApiResponse<List<ProductionRun>>> getProductionRuns();

    @POST("production-runs")
    Call<ApiResponse<ProductionRun>> triggerProductionRun(@Body Map<String, Object> payload);

    // ── Keys & Registry ─────────────────────────────────────────────────────────

    @GET("key-registry/keys")
    Call<ApiResponse<List<KeyItem>>> getKeyCatalog();

    @GET("key-registry/logs/active")
    Call<ApiResponse<List<KeyLogItem>>> getActiveLogs();

    @GET("key-registry/logs/my")
    Call<ApiResponse<List<KeyLogItem>>> getMyLogs();

    @GET("key-registry/requests/pending")
    Call<ApiResponse<List<KeyLogItem>>> getPendingRequests();

    @POST("key-registry/logs")
    Call<ApiResponse<KeyLogItem>> requestCheckout(@Body Map<String, String> payload);

    @PATCH("key-registry/logs/{id}/return")
    Call<ApiResponse<KeyLogItem>> requestReturn(
            @Path("id") String logId,
            @Body Map<String, String> payload);

    @POST("key-registry/requests/{id}/approve")
    Call<ApiResponse<KeyLogItem>> approveKeyRequest(@Path("id") String reqId);

    @POST("key-registry/requests/{id}/reject")
    Call<ApiResponse<KeyLogItem>> rejectKeyRequest(@Path("id") String reqId);

    // ── Users ───────────────────────────────────────────────────────────────────

    @GET("users")
    Call<ApiResponse<List<User>>> getUsers();

    @POST("users")
    Call<ApiResponse<User>> createUser(@Body Map<String, String> payload);

    // ── Roles ───────────────────────────────────────────────────────────────────

    @GET("roles")
    Call<ApiResponse<List<Role>>> getRoles();

    // ── Logistics & Shipments ───────────────────────────────────────────────────

    @GET("shipments/driver/assigned")
    Call<ApiResponse<List<Shipment>>> listAssignedShipments();

    @PATCH("shipments/{id}/status")
    Call<ApiResponse<Shipment>> updateShipmentStatus(
            @Path("id") String id,
            @Body Map<String, String> body  // { "status": "EN_ROUTE" }
    );

    @PATCH("shipments/{id}/stop/{stopId}")
    Call<ApiResponse<Shipment>> updateStopStatus(
            @Path("id") String shipmentId,
            @Path("stopId") String stopId,
            @Body Map<String, Object> body
    );

    @POST("shipments/driver/location")
    Call<ApiResponse<Void>> reportLocation(@Body Map<String, Double> body);

    @PATCH("shipments/driver/status")
    Call<ApiResponse<Map<String, String>>> updateDriverStatus(
            @Body Map<String, String> body  // { "status": "AVAILABLE" }
    );

    // ── Attendance (Logistics / Drivers) ────────────────────────────────────────

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
