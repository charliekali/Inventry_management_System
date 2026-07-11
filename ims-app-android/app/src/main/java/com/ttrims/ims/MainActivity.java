package com.ttrims.ims;

import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

import com.ttrims.ims.models.User;
import com.ttrims.ims.utils.SessionManager;

/**
 * MainActivity — router entry point.
 * Directs Logistics/Driver roles to DriverMainActivity, and other roles to ConsoleMainActivity.
 */
public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        SessionManager session = SessionManager.getInstance(this);
        if (!session.isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        User user = session.getUser();
        if (user == null) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        String role = user.getRoleName() != null ? user.getRoleName() : "";
        String category = user.roleCategory != null ? user.roleCategory : "";

        boolean isLogistics = "Logistics".equalsIgnoreCase(category)
                || role.toLowerCase().contains("logistics")
                || role.toLowerCase().contains("driver");

        if (isLogistics) {
            startActivity(new Intent(this, DriverMainActivity.class));
        } else {
            startActivity(new Intent(this, ConsoleMainActivity.class));
        }

        finish();
    }
}
