package com.ttrims.ims.repository;

import com.ttrims.ims.entity.ProductionPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface ProductionPlanRepository extends JpaRepository<ProductionPlan, String> {
    List<ProductionPlan> findAllByOrderByPlanDateDesc();
    List<ProductionPlan> findByAssignedUserIdAndPlanDate(String userId, LocalDate planDate);
}
