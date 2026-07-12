package com.ttrims.ims.repository;

import com.ttrims.ims.entity.PickupTask;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PickupTaskRepository extends JpaRepository<PickupTask, String> {
    List<PickupTask> findAllByOrderByCreatedAtDesc();
    List<PickupTask> findByDriverIdOrderByCreatedAtDesc(String driverId);
}
