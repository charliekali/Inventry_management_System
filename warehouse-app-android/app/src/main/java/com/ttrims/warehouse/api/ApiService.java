package com.ttrims.warehouse.api;

import com.ttrims.warehouse.models.ApiResponse;
import com.ttrims.warehouse.models.User;
import com.ttrims.warehouse.models.Product;
import com.ttrims.warehouse.models.Warehouse;
import com.ttrims.warehouse.models.Transaction;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.PATCH;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ApiService {

    @POST("auth/login")
    Call<ApiResponse<LoginData>> login(@Body Map<String, String> credentials);

    @GET("dashboard/stats")
    Call<ApiResponse<DashboardStats>> getDashboardStats();

    @GET("products")
    Call<ApiResponse<List<Product>>> getProducts(@Query("search") String query);

    @POST("transactions/in")
    Call<ApiResponse<Transaction>> logStockIn(@Body Map<String, Object> payload);

    @POST("transactions/out")
    Call<ApiResponse<Transaction>> logStockOut(@Body Map<String, Object> payload);

    @GET("warehouses")
    Call<ApiResponse<List<Warehouse>>> getWarehouses();

    @POST("warehouses")
    Call<ApiResponse<Warehouse>> createWarehouse(@Body Map<String, String> payload);

    @POST("warehouses/{id}/sections")
    Call<ApiResponse<Warehouse.Section>> createSection(
            @Path("id") String warehouseId,
            @Body Map<String, String> payload);

    @POST("auth/logout")
    Call<ApiResponse<Void>> logout();

    // ── Sales ──
    @POST("sales/invoices")
    Call<ApiResponse<Void>> completeCheckout(@Body Map<String, Object> payload);

    // ── Production ──
    @GET("recipes")
    Call<ApiResponse<List<com.ttrims.warehouse.models.Recipe>>> getRecipes();

    @POST("recipes")
    Call<ApiResponse<com.ttrims.warehouse.models.Recipe>> createRecipe(@Body Map<String, String> payload);

    @GET("production-runs")
    Call<ApiResponse<List<com.ttrims.warehouse.models.ProductionRun>>> getProductionRuns();

    @POST("production-runs")
    Call<ApiResponse<com.ttrims.warehouse.models.ProductionRun>> triggerProductionRun(@Body Map<String, Object> payload);

    // ── Keys ──
    @GET("key-registry/keys")
    Call<ApiResponse<List<com.ttrims.warehouse.models.KeyItem>>> getKeyCatalog();

    @GET("key-registry/logs/active")
    Call<ApiResponse<List<com.ttrims.warehouse.models.KeyLogItem>>> getActiveLogs();

    @GET("key-registry/logs/my")
    Call<ApiResponse<List<com.ttrims.warehouse.models.KeyLogItem>>> getMyLogs();

    @GET("key-registry/requests/pending")
    Call<ApiResponse<List<com.ttrims.warehouse.models.KeyLogItem>>> getPendingRequests();

    @POST("key-registry/logs")
    Call<ApiResponse<com.ttrims.warehouse.models.KeyLogItem>> requestCheckout(@Body Map<String, String> payload);

    @PATCH("key-registry/logs/{id}/return")
    Call<ApiResponse<com.ttrims.warehouse.models.KeyLogItem>> requestReturn(
            @Path("id") String logId,
            @Body Map<String, String> payload);

    @POST("key-registry/requests/{id}/approve")
    Call<ApiResponse<com.ttrims.warehouse.models.KeyLogItem>> approveKeyRequest(@Path("id") String reqId);

    @POST("key-registry/requests/{id}/reject")
    Call<ApiResponse<com.ttrims.warehouse.models.KeyLogItem>> rejectKeyRequest(@Path("id") String reqId);

    // ── Users ──
    @GET("users")
    Call<ApiResponse<List<User>>> getUsers();

    @POST("users")
    Call<ApiResponse<User>> createUser(@Body Map<String, String> payload);

    // ── Roles ──
    @GET("roles")
    Call<ApiResponse<List<com.ttrims.warehouse.models.Role>>> getRoles();

    // Data wrappers
    class LoginData {
        public String accessToken;
        public String refreshToken;
        public boolean sessionPermanent;
        public User user;
    }

    class DashboardStats {
        public int totalItems;
        public int lowStockCount;
        public List<Product> lowStockItems;
        public List<Transaction> recentTransactions;
    }
}
