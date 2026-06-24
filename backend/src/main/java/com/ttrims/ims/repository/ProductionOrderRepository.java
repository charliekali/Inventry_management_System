package com.ttrims.ims.repository;

import com.ttrims.ims.entity.ProductionOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductionOrderRepository extends JpaRepository<ProductionOrder, String> {
    List<ProductionOrder> findAllByOrderByCreatedAtDesc();
}
