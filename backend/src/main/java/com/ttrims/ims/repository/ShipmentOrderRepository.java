package com.ttrims.ims.repository;

import com.ttrims.ims.entity.ShipmentOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

import org.springframework.transaction.annotation.Transactional;

public interface ShipmentOrderRepository extends JpaRepository<ShipmentOrder, String> {

    @Query("SELECT so FROM ShipmentOrder so WHERE so.order.id = :orderId")
    Optional<ShipmentOrder> findByOrderId(@Param("orderId") String orderId);

    @Query("SELECT so FROM ShipmentOrder so WHERE so.order.id = :orderId")
    List<ShipmentOrder> findAllByOrderId(@Param("orderId") String orderId);

    @Transactional
    void deleteByOrderId(String orderId);
}
