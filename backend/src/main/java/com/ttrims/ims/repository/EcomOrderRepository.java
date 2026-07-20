package com.ttrims.ims.repository;

import com.ttrims.ims.entity.EcomOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EcomOrderRepository extends JpaRepository<EcomOrder, String> {
    List<EcomOrder> findByCustomerIdOrderByCreatedAtDesc(String customerId);
    Optional<EcomOrder> findByOrderNumber(String orderNumber);
}
