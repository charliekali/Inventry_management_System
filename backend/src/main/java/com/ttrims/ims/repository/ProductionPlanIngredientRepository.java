package com.ttrims.ims.repository;

import com.ttrims.ims.entity.ProductionPlanIngredient;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductionPlanIngredientRepository extends JpaRepository<ProductionPlanIngredient, String> {
    List<ProductionPlanIngredient> findByProductionPlanId(String planId);
}
