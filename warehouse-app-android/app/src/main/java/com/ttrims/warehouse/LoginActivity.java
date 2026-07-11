package com.ttrims.warehouse;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.ttrims.warehouse.api.ApiClient;
import com.ttrims.warehouse.api.ApiService;
import com.ttrims.warehouse.databinding.ActivityLoginBinding;
import com.ttrims.warehouse.models.ApiResponse;
import com.ttrims.warehouse.utils.SessionManager;

import java.util.HashMap;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    private ActivityLoginBinding binding;
    private SessionManager session;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        session = SessionManager.getInstance(this);

        // Pre-fill server URL field if set
        String savedUrl = session.getServerUrl();
        if (savedUrl != null) {
            binding.etServerUrl.setText(savedUrl);
        }

        // Long-press on login card to reveal custom server URL field
        binding.loginCard.setOnLongClickListener(v -> {
            if (binding.tilServerUrl.getVisibility() == View.VISIBLE) {
                binding.tilServerUrl.setVisibility(View.GONE);
            } else {
                binding.tilServerUrl.setVisibility(View.VISIBLE);
                Toast.makeText(this, "API Settings Revealed", Toast.LENGTH_SHORT).show();
            }
            return true;
        });

        binding.btnLogin.setOnClickListener(v -> attemptLogin());
    }

    private void attemptLogin() {
        String email = binding.etEmail.getText().toString().trim();
        String password = binding.etPassword.getText().toString().trim();
        String customUrl = binding.etServerUrl.getText().toString().trim();

        if (email.isEmpty() || password.isEmpty()) {
            binding.tvLoginError.setText(getString(R.string.login_error_empty));
            binding.tvLoginError.setVisibility(View.VISIBLE);
            return;
        }

        binding.tvLoginError.setVisibility(View.GONE);
        setLoading(true);

        // Update API endpoint if custom URL was supplied
        if (binding.tilServerUrl.getVisibility() == View.VISIBLE) {
            if (!customUrl.isEmpty()) {
                if (!customUrl.endsWith("/")) customUrl += "/";
                session.saveServerUrl(customUrl);
            } else {
                session.saveServerUrl(null);
            }
            ApiClient.invalidate();
        }

        ApiService api = ApiClient.getService(this);
        Map<String, String> creds = new HashMap<>();
        creds.put("email", email);
        creds.put("password", password);

        api.login(creds).enqueue(new Callback<ApiResponse<ApiService.LoginData>>() {
            @Override
            public void onResponse(Call<ApiResponse<ApiService.LoginData>> call,
                                   Response<ApiResponse<ApiService.LoginData>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null && response.body().success) {
                    ApiService.LoginData d = response.body().data;
                    session.saveTokens(d.accessToken, d.refreshToken);
                    if (d.user != null) session.saveUser(d.user);

                    Toast.makeText(LoginActivity.this,
                            "Welcome, " + (d.user != null ? d.user.name : "User") + "!",
                            Toast.LENGTH_SHORT).show();

                    startActivity(new Intent(LoginActivity.this, MainActivity.class));
                    finish();
                } else {
                    String msg = response.body() != null ? response.body().message : getString(R.string.error_server);
                    binding.tvLoginError.setText(msg != null ? msg : getString(R.string.error_unauthorized));
                    binding.tvLoginError.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<ApiService.LoginData>> call, Throwable t) {
                setLoading(false);
                binding.tvLoginError.setText(getString(R.string.error_network));
                binding.tvLoginError.setVisibility(View.VISIBLE);
            }
        });
    }

    private void setLoading(boolean isLoading) {
        binding.btnLogin.setEnabled(!isLoading);
        binding.btnLogin.setText(isLoading ? getString(R.string.login_loading) : getString(R.string.btn_login));
        binding.loginProgress.setVisibility(isLoading ? View.VISIBLE : View.GONE);
    }
}
