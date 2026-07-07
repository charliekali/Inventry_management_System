package com.ttrims.ims.repository;

import com.ttrims.ims.entity.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ShipmentRepository extends JpaRepository<Shipment, String> {
    List<Shipment> findAllByOrderByCreatedAtDesc();
    List<Shipment> findByStatusOrderByCreatedAtDesc(Shipment.Status status);
    Optional<Shipment> findFirstByShipmentNumberStartingWithOrderByShipmentNumberDesc(String prefix);
}
