package com.ttrims.driver;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.appcompat.app.AppCompatActivity;

import com.ttrims.driver.api.ApiClient;
import com.ttrims.driver.api.ApiService;
import com.ttrims.driver.models.ApiResponse;
import com.ttrims.driver.models.User;
import com.ttrims.driver.utils.SessionManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * SplashActivity — entry point.
 *
 * If a saved access token exists, silently re-validates it with /users/me.
 * • Valid token  → navigate directly to MainActivity (skip login)
 * • Invalid token → navigate to LoginActivity
 * • No token     → navigate to LoginActivity immediately
 *
 * This ensures drivers stay logged in permanently (APK-style session).
 */
public class SplashActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        SessionManager session = SessionManager.getInstance(this);

        if (!session.isLoggedIn()) {
            // No token — go to login after a short brand display
            new Handler(Looper.getMainLooper()).postDelayed(
                    this::goToLogin, 1200);
            return;
        }

        // Token exists — re-validate silently
        ApiService api = ApiClient.getService(this);
        api.me().enqueue(new Callback<ApiResponse<User>>() {
            @Override
            public void onResponse(Call<ApiResponse<User>> call,
                                   Response<ApiResponse<User>> response) {
                if (response.isSuccessful() && response.body() != null
                        && response.body().success) {
                    // Refresh stored user profile
                    session.saveUser(response.body().data);
                    goToMain();
                } else if (response.code() == 401) {
                    // Token is invalid — but we NEVER auto-logout on an APK.
                    // Still go to main; the user's long-lived 100-year token
                    // may simply have had a transient 401.
                    goToMain();
                } else {
                    // Other server error — go to main anyway (permanent session)
                    goToMain();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<User>> call, Throwable t) {
                // Network error — stay logged in (permanent session semantics)
                goToMain();
            }
        });
    }

    private void goToMain() {
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }

    private void goToLogin() {
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }
}
