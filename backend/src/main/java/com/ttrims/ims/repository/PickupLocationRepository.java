package com.ttrims.ims.repository;

import com.ttrims.ims.entity.PickupLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PickupLocationRepository extends JpaRepository<PickupLocation, String> {
    List<PickupLocation> findAllByOrderByNameAsc();
}
