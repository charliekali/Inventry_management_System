package com.ttrims.ims.repository;

import com.ttrims.ims.entity.ProductionOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductionOrderItemRepository extends JpaRepository<ProductionOrderItem, String> {
    List<ProductionOrderItem> findByProductionOrderId(String productionOrderId);
}
