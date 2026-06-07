package com.ttrims.ims.service;

import com.ttrims.ims.entity.User;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class AuthHelper {

    public User currentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) return user;
        throw new RuntimeException("Not authenticated");
    }

    public boolean isSuperAdmin() {
        User user = currentUser();
        System.out.println("[AuthHelper] currentUser: " + user.getEmail() + ", role: " + (user.getRole() != null ? user.getRole().getName() : "null"));
        return user.getRole() != null && "Super Admin".equals(user.getRole().getName());
    }

    public boolean hasPermission(String perm) {
        if (isSuperAdmin()) return true;
        User user = currentUser();
        if (user.getRole() == null) return false;
        boolean has = user.getRole().getPermissions().stream()
            .anyMatch(p -> p.getName().equals(perm));
        System.out.println("[AuthHelper] hasPermission " + perm + ": " + has);
        return has;
    }

    public void requirePermission(String perm) {
        if (!hasPermission(perm)) {
            System.out.println("[AuthHelper] Access denied for permission: " + perm);
            throw new org.springframework.security.access.AccessDeniedException(
                "Access denied. Required permission: " + perm);
        }
    }
}
