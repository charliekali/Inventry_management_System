package com.ttrims.driver.api;

import android.content.Context;

import com.ttrims.driver.utils.SessionManager;

import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

import java.io.IOException;

/**
 * OkHttp interceptor that attaches the stored JWT Bearer token to every request.
 */
public class AuthInterceptor implements Interceptor {

    private final Context context;

    public AuthInterceptor(Context context) {
        this.context = context.getApplicationContext();
    }

    @Override
    public Response intercept(Chain chain) throws IOException {
        String token = SessionManager.getInstance(context).getAccessToken();

        Request original = chain.request();
        Request.Builder builder = original.newBuilder()
                .header("Content-Type", "application/json")
                .header("Accept", "application/json");

        if (token != null && !token.isEmpty()) {
            builder.header("Authorization", "Bearer " + token);
        }

        // Identify as native Android driver app
        builder.header("X-Is-Native", "true");
        builder.header("X-App-Type", "driver-android");

        return chain.proceed(builder.build());
    }
}
