package com.ttrims.ims.api;

import android.content.Context;

import com.ttrims.ims.utils.SessionManager;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

import java.util.concurrent.TimeUnit;

/**
 * Singleton Retrofit client.
 *
 * The base URL can be overridden by the user via SessionManager (customApiUrl),
 * otherwise defaults to the production backend.
 */
public class ApiClient {

    public static final String DEFAULT_BASE_URL =
            "https://ttrims-backend-4xho-4xho.onrender.com/api/";

    private static Retrofit retrofit;
    private static ApiService apiService;
    private static String lastBaseUrl = null;

    /** Returns the appropriate base URL (custom override > production default). */
    public static String resolveBaseUrl(Context ctx) {
        String custom = SessionManager.getInstance(ctx).getCustomApiUrl();
        if (custom != null && !custom.isEmpty()) {
            // Ensure trailing slash
            return custom.endsWith("/") ? custom : custom + "/";
        }
        return DEFAULT_BASE_URL;
    }

    /**
     * Returns a lazily-created (and cached) ApiService.
     * Re-creates if the base URL changes at runtime (e.g. user types a custom URL).
     */
    public static ApiService getService(Context ctx) {
        String baseUrl = resolveBaseUrl(ctx);
        if (apiService == null || !baseUrl.equals(lastBaseUrl)) {
            lastBaseUrl = baseUrl;
            retrofit = buildRetrofit(ctx, baseUrl);
            apiService = retrofit.create(ApiService.class);
        }
        return apiService;
    }

    private static Retrofit buildRetrofit(Context ctx, String baseUrl) {
        HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
        logging.setLevel(HttpLoggingInterceptor.Level.BODY);

        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .addInterceptor(new AuthInterceptor(ctx))
                .addInterceptor(logging)
                .build();

        Gson gson = new GsonBuilder()
                .setLenient()
                .serializeNulls()
                .create();

        return new Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create(gson))
                .build();
    }

    /** Invalidate and force rebuild on next call (e.g. after custom URL is saved). */
    public static void invalidate() {
        apiService = null;
        retrofit = null;
        lastBaseUrl = null;
    }
}
