package com.ttrims.ims.repository;

import com.ttrims.ims.entity.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WarehouseRepository extends JpaRepository<Warehouse, String> {
    List<Warehouse> findByActiveTrueOrderByName();
}
