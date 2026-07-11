package com.ttrims.ims;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.GravityCompat;
import androidx.fragment.app.Fragment;

import com.ttrims.ims.databinding.ActivityMainConsoleBinding;
import com.ttrims.ims.fragments.DashboardFragment;
import com.ttrims.ims.fragments.WarehouseFragment;
import com.ttrims.ims.fragments.StockInFragment;
import com.ttrims.ims.fragments.StockOutFragment;
import com.ttrims.ims.fragments.FinderFragment;
import com.ttrims.ims.fragments.PosFragment;
import com.ttrims.ims.fragments.RecipeFragment;
import com.ttrims.ims.fragments.ProductionRunsFragment;
import com.ttrims.ims.fragments.KeyRegistryFragment;
import com.ttrims.ims.fragments.UserFragment;
import com.ttrims.ims.fragments.RoleFragment;
import com.ttrims.ims.fragments.WarehouseHostFragment;
import com.ttrims.ims.models.User;
import com.ttrims.ims.utils.SessionManager;

public class ConsoleMainActivity extends AppCompatActivity {

    private ActivityMainConsoleBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityMainConsoleBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // Get logged-in user details
        User user = SessionManager.getInstance(this).getUser();

        // Populate topbar avatar
        if (user != null) {
            binding.topbarAvatar.setText(user.initials());
        }

        // Set sidebar drawer header values
        View headerView = binding.navView.getHeaderView(0);
        if (headerView != null && user != null) {
            TextView tvUser = headerView.findViewById(R.id.nav_header_username);
            TextView tvEmail = headerView.findViewById(R.id.nav_header_email);
            if (tvUser != null) tvUser.setText(user.name);
            if (tvEmail != null) tvEmail.setText(user.email);
        }

        // Apply role-based visibility filter to navigation drawer items
        filterDrawerMenu(user);

        // Click menu toggle icon to open sidebar drawer
        binding.btnMenuToggle.setOnClickListener(v -> {
            binding.drawerLayout.openDrawer(GravityCompat.START);
        });

        // Click avatar to trigger logout dialog
        binding.topbarAvatar.setOnClickListener(v -> showLogoutDialog());

        // Setup sidebar item clicks
        binding.navView.setNavigationItemSelectedListener(item -> {
            int id = item.getItemId();
            Fragment fragment = null;
            String title = "TTRIMS Console";

            if (id == R.id.nav_home) {
                fragment = new DashboardFragment();
                title = "Home Dashboard";
            } else if (id == R.id.nav_warehouse || id == R.id.nav_stock_in || id == R.id.nav_stock_out || id == R.id.nav_finder) {
                fragment = new WarehouseHostFragment();
                Bundle args = new Bundle();
                args.putInt(WarehouseHostFragment.EXTRA_INITIAL_TAB, id);
                fragment.setArguments(args);
                title = "Warehouse App";
            } else if (id == R.id.nav_pos) {
                fragment = new PosFragment();
                title = "POS Billing Terminal";
            } else if (id == R.id.nav_recipes) {
                fragment = new RecipeFragment();
                title = "Recipes & Formulas";
            } else if (id == R.id.nav_production_runs) {
                fragment = new ProductionRunsFragment();
                title = "Production Runs";
            } else if (id == R.id.nav_key_registry) {
                fragment = new KeyRegistryFragment();
                title = "Key Registry";
            } else if (id == R.id.nav_users) {
                fragment = new UserFragment();
                title = "User Management";
            } else if (id == R.id.nav_roles) {
                fragment = new RoleFragment();
                title = "Role Management";
            }

            if (fragment != null) {
                switchFragment(fragment);
                binding.topbarTitle.setText(title);
            }

            binding.drawerLayout.closeDrawer(GravityCompat.START);
            return true;
        });

        // Load Default Dashboard on start
        if (savedInstanceState == null) {
            switchFragment(new DashboardFragment());
            binding.topbarTitle.setText("Home Dashboard");
            binding.navView.setCheckedItem(R.id.nav_home);
        }
    }

    private void filterDrawerMenu(User user) {
        if (user == null) return;

        String role = user.getRoleName();
        String category = user.roleCategory;

        boolean isSuperAdmin = "Super Admin".equalsIgnoreCase(role) || "Super Admin".equalsIgnoreCase(category);
        if (isSuperAdmin) {
            // Super Admin can see EVERYTHING
            return;
        }

        android.view.Menu menu = binding.navView.getMenu();

        boolean isWarehouse = "Warehouse".equalsIgnoreCase(category) 
                || role.toLowerCase().contains("warehouse") 
                || role.toLowerCase().contains("keeper");

        boolean isSales = "Sales".equalsIgnoreCase(category) 
                || role.toLowerCase().contains("sales");

        boolean isProduction = "Production".equalsIgnoreCase(category) 
                || role.toLowerCase().contains("production");

        boolean isLogistics = "Logistics".equalsIgnoreCase(category) 
                || role.toLowerCase().contains("logistics") 
                || role.toLowerCase().contains("driver");

        // Hide Warehouse items if not warehouse
        if (!isWarehouse) {
            menu.findItem(R.id.nav_warehouse).setVisible(false);
            menu.findItem(R.id.nav_stock_in).setVisible(false);
            menu.findItem(R.id.nav_stock_out).setVisible(false);
            menu.findItem(R.id.nav_finder).setVisible(false);
        }

        // Hide Sales items if not sales
        if (!isSales) {
            menu.findItem(R.id.nav_pos).setVisible(false);
        }

        // Hide Production items if not production
        if (!isProduction) {
            menu.findItem(R.id.nav_recipes).setVisible(false);
            menu.findItem(R.id.nav_production_runs).setVisible(false);
        }

        // Hide Logistics items if not logistics
        if (!isLogistics) {
            menu.findItem(R.id.nav_key_registry).setVisible(false);
        }

        // Hide Admin items for everyone except Super Admin
        menu.findItem(R.id.nav_users).setVisible(false);
        menu.findItem(R.id.nav_roles).setVisible(false);
    }

    private void switchFragment(Fragment fragment) {
        getSupportFragmentManager().beginTransaction()
                .replace(R.id.nav_host_fragment, fragment)
                .commit();
    }

    public void selectNavigationItem(int id) {
        binding.navView.setCheckedItem(id);
        Fragment fragment = null;
        String title = "TTRIMS Console";

        if (id == R.id.nav_home) {
            fragment = new DashboardFragment();
            title = "Home Dashboard";
        } else if (id == R.id.nav_warehouse || id == R.id.nav_stock_in || id == R.id.nav_stock_out || id == R.id.nav_finder) {
            fragment = new WarehouseHostFragment();
            Bundle args = new Bundle();
            args.putInt(WarehouseHostFragment.EXTRA_INITIAL_TAB, id);
            fragment.setArguments(args);
            title = "Warehouse App";
        } else if (id == R.id.nav_pos) {
            fragment = new PosFragment();
            title = "POS Billing Terminal";
        } else if (id == R.id.nav_recipes) {
            fragment = new RecipeFragment();
            title = "Recipes & Formulas";
        } else if (id == R.id.nav_production_runs) {
            fragment = new ProductionRunsFragment();
            title = "Production Runs";
        } else if (id == R.id.nav_key_registry) {
            fragment = new KeyRegistryFragment();
            title = "Key Registry";
        } else if (id == R.id.nav_users) {
            fragment = new UserFragment();
            title = "User Management";
        } else if (id == R.id.nav_roles) {
            fragment = new RoleFragment();
            title = "Role Management";
        }

        if (fragment != null) {
            switchFragment(fragment);
            binding.topbarTitle.setText(title);
        }
    }

    private void showLogoutDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Sign Out")
                .setMessage("Are you sure you want to sign out of TTRIMS Console?")
                .setPositiveButton("Sign Out", (dialog, which) -> {
                    SessionManager.getInstance(this).clearSession();
                    Toast.makeText(this, "Signed out", Toast.LENGTH_SHORT).show();
                    startActivity(new Intent(this, LoginActivity.class));
                    finish();
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    @Override
    public void onBackPressed() {
        if (binding.drawerLayout.isDrawerOpen(GravityCompat.START)) {
            binding.drawerLayout.closeDrawer(GravityCompat.START);
        } else {
            super.onBackPressed();
        }
    }
}
