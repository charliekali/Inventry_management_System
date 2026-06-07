package com.ttrims.ims.repository;

import com.ttrims.ims.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmailAndActiveTrue(String email);
    Optional<User> findByIdAndActiveTrue(String id);
    boolean existsByEmail(String email);
    List<User> findAllByOrderByCreatedAtDesc();
}
