package com.ttrims.ims.repository;

import com.ttrims.ims.entity.Section;
import com.ttrims.ims.entity.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SectionRepository extends JpaRepository<Section, String> {
    List<Section> findByWarehouseAndActiveTrueOrderByName(Warehouse warehouse);
    List<Section> findByWarehouseId(String warehouseId);
}
