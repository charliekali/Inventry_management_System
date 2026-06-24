package com.ttrims.ims.repository;

import com.ttrims.ims.entity.PostgresInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PostgresInstanceRepository extends JpaRepository<PostgresInstance, String> {
    boolean existsByName(String name);
    Optional<PostgresInstance> findByName(String name);
}
