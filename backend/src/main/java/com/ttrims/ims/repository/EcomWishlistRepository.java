package com.ttrims.ims.repository;

import com.ttrims.ims.entity.EcomWishlist;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EcomWishlistRepository extends JpaRepository<EcomWishlist, String> {
    List<EcomWishlist> findByCustomerId(String customerId);
    Optional<EcomWishlist> findByCustomerIdAndProductId(String customerId, String productId);
}
