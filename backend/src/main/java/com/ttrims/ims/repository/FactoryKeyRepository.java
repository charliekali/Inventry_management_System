package com.ttrims.ims.repository;

import com.ttrims.ims.entity.FactoryKey;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FactoryKeyRepository extends JpaRepository<FactoryKey, String> {
    List<FactoryKey> findAllByOrderByNameAsc();
    List<FactoryKey> findByStatusOrderByNameAsc(String status);
    boolean existsByKeyNumber(String keyNumber);
}
