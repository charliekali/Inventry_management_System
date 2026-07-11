package com.ttrims.warehouse.api;

import android.content.Context;
import com.ttrims.warehouse.utils.SessionManager;
import java.io.IOException;
import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

public class AuthInterceptor implements Interceptor {

    private final Context context;

    public AuthInterceptor(Context context) {
        this.context = context.getApplicationContext();
    }

    @Override
    public Response intercept(Chain chain) throws IOException {
        Request original = chain.request();
        Request.Builder builder = original.newBuilder()
                .header("Accept", "application/json")
                .header("X-Is-Native", "true")
                .header("X-App-Type", "warehouse-android");

        // Read JWT from permanent session manager
        String token = SessionManager.getInstance(context).getAccessToken();
        if (token != null && !token.isEmpty()) {
            builder.header("Authorization", "Bearer " + token);
        }

        return chain.proceed(builder.build());
    }
}
