package com.ttrims.ims.repository;

import com.ttrims.ims.entity.EcomCoupon;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EcomCouponRepository extends JpaRepository<EcomCoupon, String> {
    Optional<EcomCoupon> findByCodeAndActiveTrue(String code);
}
