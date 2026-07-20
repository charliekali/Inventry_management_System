package com.ttrims.ims.repository;

import com.ttrims.ims.entity.EcomCustomer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EcomCustomerRepository extends JpaRepository<EcomCustomer, String> {
    Optional<EcomCustomer> findByEmail(String email);
}
