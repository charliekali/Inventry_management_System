package com.ttrims.ims.repository;

import com.ttrims.ims.entity.ShipmentOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ShipmentOrderRepository extends JpaRepository<ShipmentOrder, String> {
    List<ShipmentOrder> findByShipmentId(String shipmentId);
    List<ShipmentOrder> findByOrderId(String orderId);
}
