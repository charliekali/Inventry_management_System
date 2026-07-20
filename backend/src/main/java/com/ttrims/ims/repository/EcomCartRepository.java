package com.ttrims.ims.repository;

import com.ttrims.ims.entity.EcomCart;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EcomCartRepository extends JpaRepository<EcomCart, String> {
    Optional<EcomCart> findByCustomerId(String customerId);
}
