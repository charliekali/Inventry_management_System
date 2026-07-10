package com.ttrims.ims.repository;

import com.ttrims.ims.entity.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ShipmentRepository extends JpaRepository<Shipment, String> {
    List<Shipment> findAllByOrderByCreatedAtDesc();
    List<Shipment> findByStatusOrderByCreatedAtDesc(Shipment.Status status);
    Optional<Shipment> findFirstByShipmentNumberStartingWithOrderByShipmentNumberDesc(String prefix);

    @Query("SELECT COUNT(s) FROM Shipment s WHERE s.driver.id = :driverId AND s.status IN ('CREATED', 'EN_ROUTE')")
    long countActiveShipmentsByDriver(@Param("driverId") String driverId);

    @Query("SELECT s FROM Shipment s WHERE s.driver.id = :driverId AND s.status IN ('CREATED', 'EN_ROUTE')")
    List<Shipment> findActiveShipmentsByDriver(@Param("driverId") String driverId);
}
