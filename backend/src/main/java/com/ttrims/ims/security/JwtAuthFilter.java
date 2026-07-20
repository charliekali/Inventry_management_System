package com.ttrims.ims.security;

import com.ttrims.ims.entity.User;
import com.ttrims.ims.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtils jwtUtils;
    private final UserRepository userRepository;
    private final com.ttrims.ims.repository.EcomCustomerRepository ecomCustomerRepository;

    public JwtAuthFilter(JwtUtils jwtUtils, UserRepository userRepository, com.ttrims.ims.repository.EcomCustomerRepository ecomCustomerRepository) {
        this.jwtUtils = jwtUtils;
        this.userRepository = userRepository;
        this.ecomCustomerRepository = ecomCustomerRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null && jwtUtils.validateToken(token)) {
            String userId = jwtUtils.getUserIdFromToken(token);
            var adminUser = userRepository.findByIdAndActiveTrue(userId);
            if (adminUser.isPresent()) {
                User user = adminUser.get();
                List<SimpleGrantedAuthority> authorities = buildAuthorities(user);
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(user, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
            } else {
                ecomCustomerRepository.findById(userId).ifPresent(customer -> {
                    UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(customer, null, List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER")));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                });
            }
        }
        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }

    private List<SimpleGrantedAuthority> buildAuthorities(User user) {
        if (user.getRole() == null) return List.of();
        return user.getRole().getPermissions().stream()
            .map(p -> new SimpleGrantedAuthority(p.getName()))
            .collect(Collectors.toList());
    }
}
